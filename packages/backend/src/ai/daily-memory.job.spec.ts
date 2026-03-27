import { DailyMemoryJob } from './daily-memory.job';
import type { SlackChannel } from '../shared/db/models/SlackChannel';
import { DAILY_MEMORY_JOB_CONCURRENCY } from './ai.constants';

jest.mock('typeorm', () => ({
  getRepository: jest.fn().mockReturnValue({
    find: jest.fn(),
  }),
  Entity: () => jest.fn(),
  Column: () => jest.fn(),
  PrimaryGeneratedColumn: () => jest.fn(),
  ManyToOne: () => jest.fn(),
  OneToMany: () => jest.fn(),
  OneToOne: () => jest.fn(),
  Unique: () => jest.fn(),
  JoinColumn: () => jest.fn(),
}));

jest.mock('../shared/logger/logger', () => ({
  logger: {
    child: jest.fn().mockReturnValue({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

import { getRepository } from 'typeorm';

const buildJob = (): DailyMemoryJob => {
  const job = new DailyMemoryJob();

  job.aiService = {
    extractMemoriesForChannel: jest.fn().mockResolvedValue(undefined),
  } as unknown as DailyMemoryJob['aiService'];

  (job as unknown as { jobLogger: Record<string, jest.Mock> }).jobLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  return job;
};

describe('DailyMemoryJob', () => {
  let job: DailyMemoryJob;
  let findMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    job = buildJob();
    findMock = (getRepository as jest.Mock)().find as jest.Mock;
  });

  it('calls extractMemoriesForChannel for each channel', async () => {
    const channels: Partial<SlackChannel>[] = [
      { channelId: 'C1', teamId: 'T1' },
      { channelId: 'C2', teamId: 'T1' },
    ];
    findMock.mockResolvedValue(channels);

    await job.run();

    expect(job.aiService.extractMemoriesForChannel).toHaveBeenCalledTimes(2);
    expect(job.aiService.extractMemoriesForChannel).toHaveBeenCalledWith('T1', 'C1');
    expect(job.aiService.extractMemoriesForChannel).toHaveBeenCalledWith('T1', 'C2');
  });

  it('continues processing remaining channels when one fails', async () => {
    const channels: Partial<SlackChannel>[] = [
      { channelId: 'C1', teamId: 'T1' },
      { channelId: 'C2', teamId: 'T1' },
    ];
    findMock.mockResolvedValue(channels);
    (job.aiService.extractMemoriesForChannel as jest.Mock)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);

    await job.run();

    expect(job.aiService.extractMemoriesForChannel).toHaveBeenCalledTimes(2);
  });

  it('handles an empty channel list gracefully', async () => {
    findMock.mockResolvedValue([]);

    await job.run();

    expect(job.aiService.extractMemoriesForChannel).not.toHaveBeenCalled();
  });

  it('processes all channels even when count exceeds the concurrency limit', async () => {
    const channels: Partial<SlackChannel>[] = Array.from({ length: DAILY_MEMORY_JOB_CONCURRENCY + 2 }, (_, i) => ({
      channelId: `C${i}`,
      teamId: 'T1',
    }));
    findMock.mockResolvedValue(channels);

    await job.run();

    expect(job.aiService.extractMemoriesForChannel).toHaveBeenCalledTimes(channels.length);
  });

  it('processes channels in batches so at most DAILY_MEMORY_JOB_CONCURRENCY run at once', async () => {
    const channels: Partial<SlackChannel>[] = Array.from({ length: DAILY_MEMORY_JOB_CONCURRENCY + 1 }, (_, i) => ({
      channelId: `C${i}`,
      teamId: 'T1',
    }));
    findMock.mockResolvedValue(channels);

    let maxInflight = 0;
    let currentInflight = 0;
    (job.aiService.extractMemoriesForChannel as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          currentInflight++;
          if (currentInflight > maxInflight) maxInflight = currentInflight;
          setImmediate(() => {
            currentInflight--;
            resolve();
          });
        }),
    );

    await job.run();

    expect(maxInflight).toBeLessThanOrEqual(DAILY_MEMORY_JOB_CONCURRENCY);
    expect(job.aiService.extractMemoriesForChannel).toHaveBeenCalledTimes(channels.length);
  });
});
