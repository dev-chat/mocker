import { vi } from 'vitest';

vi.mock('../shared/db/models/BathroomTimer', async () => ({
  BathroomTimer: class BathroomTimer {},
}));

vi.mock('../shared/db/models/BathroomUser', async () => ({
  BathroomUser: class BathroomUser {},
}));

vi.mock('typeorm', async () => ({
  getRepository: vi.fn(),
}));

import { getRepository } from 'typeorm';
import {
  ActiveTimerExistsError,
  ActiveTimerNotFoundError,
  BathroomUserNotFoundError,
  BathroomPersistenceService,
} from './bathroom.persistence.service';
import { BathroomTimer } from '../shared/db/models/BathroomTimer';
import { BathroomUser } from '../shared/db/models/BathroomUser';

describe('BathroomPersistenceService', () => {
  const userRepo = {
    findOne: vi.fn(),
    save: vi.fn(),
  };

  const timerQueryBuilder = {
    innerJoin: vi.fn().mockReturnThis(),
    innerJoinAndSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    getOne: vi.fn(),
    getMany: vi.fn(),
  };

  const timerRepo = {
    save: vi.fn(),
    createQueryBuilder: vi.fn(() => timerQueryBuilder),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (getRepository as Mock).mockImplementation((model: unknown) => {
      if (model === BathroomUser) {
        return userRepo;
      }
      if (model === BathroomTimer) {
        return timerRepo;
      }
      return {};
    });
  });

  it('creates a new timer when no active timer exists', async () => {
    const service = new BathroomPersistenceService();
    const user = { id: 1, slackId: 'U1', displayName: 'Alice', avatarUrl: null };
    const savedTimer = {
      id: 10,
      user,
      startAt: new Date('2026-06-30T12:00:00.000Z'),
      endAt: null,
      durationSeconds: null,
    };

    userRepo.findOne.mockResolvedValue(user);
    timerQueryBuilder.getOne.mockResolvedValue(null);
    timerRepo.save.mockResolvedValue(savedTimer);

    const result = await service.startTimer('U1');

    expect(result).toBe(savedTimer);
    expect(userRepo.findOne).toHaveBeenCalledWith({ where: { slackId: 'U1' } });
    expect(timerRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        user,
        endAt: null,
        durationSeconds: null,
      }),
    );
  });

  it('throws when starting a timer with an existing active timer', async () => {
    const service = new BathroomPersistenceService();
    userRepo.findOne.mockResolvedValue({ id: 1, slackId: 'U1' });
    timerQueryBuilder.getOne.mockResolvedValue({ id: 7 });

    await expect(service.startTimer('U1')).rejects.toBeInstanceOf(ActiveTimerExistsError);
  });

  it('throws when starting a timer for an unknown user', async () => {
    const service = new BathroomPersistenceService();
    userRepo.findOne.mockResolvedValue(null);

    await expect(service.startTimer('U1')).rejects.toBeInstanceOf(BathroomUserNotFoundError);
  });

  it('stops the active timer and persists its duration in seconds', async () => {
    const service = new BathroomPersistenceService();
    const activeTimer = {
      id: 7,
      user: { id: 1, slackId: 'U1', displayName: 'Alice', avatarUrl: null },
      startAt: new Date('2026-06-30T12:00:00.000Z'),
      endAt: null,
      durationSeconds: null,
    };
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-30T12:05:45.000Z'));
    timerQueryBuilder.getOne.mockResolvedValue(activeTimer);
    timerRepo.save.mockImplementation(async (timer: typeof activeTimer) => timer);

    const result = await service.stopTimer('U1');

    expect(result.durationSeconds).toBe(345);
    expect(result.endAt?.toISOString()).toBe('2026-06-30T12:05:45.000Z');
    vi.useRealTimers();
  });

  it('throws when stopping a timer that does not exist', async () => {
    const service = new BathroomPersistenceService();
    timerQueryBuilder.getOne.mockResolvedValue(null);

    await expect(service.stopTimer('U1')).rejects.toBeInstanceOf(ActiveTimerNotFoundError);
  });

  it('builds an ascending leaderboard using the overlapping portion of each timer', async () => {
    const service = new BathroomPersistenceService();
    timerQueryBuilder.getMany.mockResolvedValue([
      {
        id: 1,
        user: { slackId: 'U1', displayName: 'Alice' },
        startAt: new Date('2026-06-29T23:59:30.000Z'),
        endAt: new Date('2026-06-30T00:01:00.000Z'),
      },
      {
        id: 2,
        user: { slackId: 'U2', displayName: 'Bob' },
        startAt: new Date('2026-06-30T12:00:00.000Z'),
        endAt: new Date('2026-06-30T12:00:15.000Z'),
      },
      {
        id: 3,
        user: { slackId: 'U1', displayName: 'Alice' },
        startAt: new Date('2026-06-30T23:59:45.000Z'),
        endAt: new Date('2026-07-01T00:02:00.000Z'),
      },
    ]);

    const result = await service.getLeaderboardForDate(new Date('2026-06-30T12:00:00.000Z'));

    expect(result).toEqual([
      { slackId: 'U2', displayName: 'Bob', totalSeconds: 15 },
      { slackId: 'U1', displayName: 'Alice', totalSeconds: 75 },
    ]);
  });
});
