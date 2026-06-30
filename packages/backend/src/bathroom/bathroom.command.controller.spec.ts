import { afterEach, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const upsertUserMock = vi.fn();
const startTimerMock = vi.fn();
const stopTimerMock = vi.fn();
const getLeaderboardForRangeMock = vi.fn();
const getLifetimeLeaderboardMock = vi.fn();

vi.mock('../shared/middleware/suppression', async () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('./bathroom.persistence.service', async () => {
  class ActiveTimerExistsError extends Error {}
  class ActiveTimerNotFoundError extends Error {}

  return {
    ActiveTimerExistsError,
    ActiveTimerNotFoundError,
    BathroomPersistenceService: classMock(() => ({
      upsertUser: upsertUserMock,
      startTimer: startTimerMock,
      stopTimer: stopTimerMock,
      getLeaderboardForRange: getLeaderboardForRangeMock,
      getLifetimeLeaderboard: getLifetimeLeaderboardMock,
    })),
  };
});

import { ActiveTimerExistsError, ActiveTimerNotFoundError } from './bathroom.persistence.service';
import { bathroomCommandController } from './bathroom.command.controller';

describe('bathroomCommandController', () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/', bathroomCommandController);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-30T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a timer for the slash command user after upserting their profile', async () => {
    upsertUserMock.mockResolvedValue({ slackId: 'U123' });
    startTimerMock.mockResolvedValue({
      id: 4,
      startAt: new Date('2026-06-30T12:00:00.000Z'),
      endAt: null,
      durationSeconds: null,
    });

    const res = await request(app).post('/start').send({
      command: '/start',
      team_id: 'T123',
      user_id: 'U123',
      user_name: 'alice',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      response_type: 'ephemeral',
      text: 'Bathroom timer started.',
    });
    expect(upsertUserMock).toHaveBeenCalledWith({
      slackId: 'U123',
      displayName: 'alice',
      avatarUrl: null,
    });
    expect(startTimerMock).toHaveBeenCalledWith('U123');
  });

  it('returns a friendly message when a timer is already running', async () => {
    upsertUserMock.mockResolvedValue({ slackId: 'U123' });
    startTimerMock.mockRejectedValue(new ActiveTimerExistsError());

    const res = await request(app).post('/start').send({
      command: '/start',
      team_id: 'T123',
      user_id: 'U123',
      user_name: 'alice',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      response_type: 'ephemeral',
      text: 'You already have an active bathroom timer.',
    });
  });

  it('stops a timer and returns the total duration', async () => {
    stopTimerMock.mockResolvedValue({
      id: 4,
      startAt: new Date('2026-06-30T12:00:00.000Z'),
      endAt: new Date('2026-06-30T12:05:30.000Z'),
      durationSeconds: 330,
    });

    const res = await request(app).post('/stop').send({
      command: '/stop',
      team_id: 'T123',
      user_id: 'U123',
      user_name: 'alice',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      response_type: 'ephemeral',
      text: 'Bathroom timer stopped. Total time: 5m 30s.',
    });
  });

  it('returns the requested leaderboard scopes in chat', async () => {
    getLeaderboardForRangeMock
      .mockResolvedValueOnce([{ slackId: 'U1', displayName: 'Alice', totalSeconds: 45 }])
      .mockResolvedValueOnce([{ slackId: 'U2', displayName: 'Bob', totalSeconds: 120 }])
      .mockResolvedValueOnce([]);
    getLifetimeLeaderboardMock.mockResolvedValue([{ slackId: 'U3', displayName: 'Cara', totalSeconds: 600 }]);

    const res = await request(app).post('/bathroom').send({
      command: '/bathroom',
      team_id: 'T123',
      user_id: 'U123',
      user_name: 'alice',
      text: '',
    });

    expect(res.status).toBe(200);
    expect(res.body.response_type).toBe('in_channel');
    expect(res.body.text).toContain('*Daily*');
    expect(res.body.text).toContain('1. Alice — 45s');
    expect(res.body.text).toContain('*Weekly*');
    expect(res.body.text).toContain('1. Bob — 2m');
    expect(res.body.text).toContain('*Monthly*');
    expect(res.body.text).toContain('_No completed bathroom sessions yet._');
    expect(res.body.text).toContain('*Lifetime*');
    expect(res.body.text).toContain('1. Cara — 10m');
    expect(getLeaderboardForRangeMock).toHaveBeenNthCalledWith(
      1,
      new Date('2026-06-30T00:00:00.000Z'),
      new Date('2026-07-01T00:00:00.000Z'),
    );
    expect(getLeaderboardForRangeMock).toHaveBeenNthCalledWith(
      2,
      new Date('2026-06-29T00:00:00.000Z'),
      new Date('2026-07-06T00:00:00.000Z'),
    );
    expect(getLeaderboardForRangeMock).toHaveBeenNthCalledWith(
      3,
      new Date('2026-06-01T00:00:00.000Z'),
      new Date('2026-07-01T00:00:00.000Z'),
    );
    expect(getLifetimeLeaderboardMock).toHaveBeenCalledTimes(1);
  });

  it('returns a usage hint for invalid leaderboard scopes', async () => {
    const res = await request(app).post('/bathroom').send({
      command: '/bathroom',
      team_id: 'T123',
      user_id: 'U123',
      user_name: 'alice',
      text: 'quarterly',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      response_type: 'ephemeral',
      text: 'Usage: /bathroom [daily|weekly|monthly|lifetime|all]',
    });
  });

  it('returns a friendly message when stopping without an active timer', async () => {
    stopTimerMock.mockRejectedValue(new ActiveTimerNotFoundError());

    const res = await request(app).post('/stop').send({
      command: '/stop',
      team_id: 'T123',
      user_id: 'U123',
      user_name: 'alice',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      response_type: 'ephemeral',
      text: 'You do not have an active bathroom timer.',
    });
  });
});
