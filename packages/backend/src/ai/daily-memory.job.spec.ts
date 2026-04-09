import { vi } from 'vitest';
import { DailyMemoryJob } from './daily-memory.job';
import type { SlackChannel } from '../shared/db/models/SlackChannel';
import { DAILY_MEMORY_JOB_CONCURRENCY } from './ai.constants';

vi.mock('typeorm', async () => ({
  getRepository: vi.fn().mockReturnValue({
    find: vi.fn(),
  }),
  Entity: () => vi.fn(),
  Column: () => vi.fn(),
  PrimaryGeneratedColumn: () => vi.fn(),
  ManyToOne: () => vi.fn(),
  OneToMany: () => vi.fn(),
  OneToOne: () => vi.fn(),
  Unique: () => vi.fn(),
  JoinColumn: () => vi.fn(),
}));

vi.mock('../shared/logger/logger', async () => ({
  logger: {
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

import { getRepository } from 'typeorm';

const buildJob = (): DailyMemoryJob => {
  const job = new DailyMemoryJob();

  job.aiService = {
    extractMemoriesForChannel: vi.fn().mockResolvedValue(undefined),
  } as unknown as DailyMemoryJob['aiService'];

  (job as unknown as { jobLogger: Record<string, Mock> }).jobLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  return job;
};

describe('DailyMemoryJob', () => {
  let job: DailyMemoryJob;
  let findMock: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    (getRepository as Mock).mockReturnValue({
      find: vi.fn(),
    });
    job = buildJob();
    findMock = (getRepository as Mock)().find as Mock;
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
    (job.aiService.extractMemoriesForChannel as Mock)
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

  it('processes channels with a sliding window so at most DAILY_MEMORY_JOB_CONCURRENCY run at once', async () => {
    const channels: Partial<SlackChannel>[] = Array.from({ length: DAILY_MEMORY_JOB_CONCURRENCY + 1 }, (_, i) => ({
      channelId: `C${i}`,
      teamId: 'T1',
    }));
    findMock.mockResolvedValue(channels);

    let maxInflight = 0;
    let currentInflight = 0;
    (job.aiService.extractMemoriesForChannel as Mock).mockImplementation(
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
