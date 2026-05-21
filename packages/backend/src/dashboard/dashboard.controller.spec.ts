import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const getDashboardData = vi.fn();
const getAllMemoriesForUser = vi.fn();
const getAllTraitsForUser = vi.fn();
const getArgumentLeaderboard = vi.fn();

vi.mock('./dashboard.persistence.service', async () => ({
  DashboardPersistenceService: classMock(() => ({
    getDashboardData,
  })),
}));

vi.mock('../ai/memory/memory.persistence.service', async () => ({
  MemoryPersistenceService: classMock(() => ({
    getAllMemoriesForUser,
  })),
}));

vi.mock('../trait/trait.persistence.service', async () => ({
  TraitPersistenceService: classMock(() => ({
    getAllTraitsForUser,
  })),
}));

vi.mock('../argument/argument.persistence.service', async () => ({
  ArgumentPersistenceService: classMock(() => ({
    getArgumentLeaderboard,
  })),
}));

vi.mock('../shared/logger/logger', async () => ({
  logger: { child: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }) },
}));

import { dashboardController } from './dashboard.controller';

describe('dashboardController', () => {
  const app = express();
  app.use((req, _res, next) => {
    const teamId = req.header('x-team-id');
    const userId = req.header('x-user-id');
    if (teamId || userId) {
      req.authSession = { teamId: teamId ?? undefined, userId: userId ?? undefined };
    }
    next();
  });
  app.use('/', dashboardController);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthorized dashboard requests', async () => {
    await request(app).get('/').expect(401, { error: 'Unauthorized' });
  });

  it('loads dashboard data with a valid period', async () => {
    getDashboardData.mockResolvedValue({ leaderboard: [], myStats: {}, repLeaderboard: [] });

    const res = await request(app).get('/?period=weekly').set('x-team-id', 'T1').set('x-user-id', 'U1').expect(200);

    expect(getDashboardData).toHaveBeenCalledWith('U1', 'T1', 'weekly');
    expect(res.body).toEqual({ leaderboard: [], myStats: {}, repLeaderboard: [] });
  });

  it('falls back to the default period for unknown values', async () => {
    getDashboardData.mockResolvedValue({ leaderboard: [], myStats: {}, repLeaderboard: [] });

    await request(app).get('/?period=nope').set('x-team-id', 'T1').set('x-user-id', 'U1').expect(200);

    expect(getDashboardData).toHaveBeenCalledWith('U1', 'T1', 'weekly');
  });

  it('loads personal context data', async () => {
    getAllMemoriesForUser.mockResolvedValue([
      { id: 1, content: 'likes coffee', updatedAt: '2026-05-20T00:00:00.000Z' },
    ]);
    getAllTraitsForUser.mockResolvedValue([{ id: 2, content: 'curious', updatedAt: '2026-05-21T00:00:00.000Z' }]);

    const res = await request(app).get('/personal-context').set('x-team-id', 'T1').set('x-user-id', 'U1').expect(200);

    expect(getAllMemoriesForUser).toHaveBeenCalledWith('U1', 'T1');
    expect(getAllTraitsForUser).toHaveBeenCalledWith('U1', 'T1');
    expect(res.body).toEqual({
      memories: [{ id: 1, content: 'likes coffee', updatedAt: '2026-05-20T00:00:00.000Z' }],
      traits: [{ id: 2, content: 'curious', updatedAt: '2026-05-21T00:00:00.000Z' }],
    });
  });

  it('loads argument leaderboard data', async () => {
    getArgumentLeaderboard.mockResolvedValue({
      leaderboard: [{ name: 'Alice', slackId: 'U1', wins: 2, points: 7 }],
      arguments: [],
    });

    const res = await request(app).get('/arguments').set('x-team-id', 'T1').set('x-user-id', 'U1').expect(200);

    expect(getArgumentLeaderboard).toHaveBeenCalledWith('T1');
    expect(res.body).toEqual({
      leaderboard: [{ name: 'Alice', slackId: 'U1', wins: 2, points: 7 }],
      arguments: [],
    });
  });
});
