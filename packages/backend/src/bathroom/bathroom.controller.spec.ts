import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const getUserBySlackIdMock = vi.fn();
const getActiveTimerForSlackUserMock = vi.fn();
const startTimerMock = vi.fn();
const stopTimerMock = vi.fn();
const getLeaderboardForDateMock = vi.fn();

vi.mock('./bathroom.persistence.service', async () => {
  class ActiveTimerExistsError extends Error {}
  class ActiveTimerNotFoundError extends Error {}

  return {
    ActiveTimerExistsError,
    ActiveTimerNotFoundError,
    BathroomPersistenceService: classMock(() => ({
      getUserBySlackId: getUserBySlackIdMock,
      getActiveTimerForSlackUser: getActiveTimerForSlackUserMock,
      startTimer: startTimerMock,
      stopTimer: stopTimerMock,
      getLeaderboardForDate: getLeaderboardForDateMock,
    })),
  };
});

import { ActiveTimerExistsError, ActiveTimerNotFoundError } from './bathroom.persistence.service';
import { bathroomController } from './bathroom.controller';

describe('bathroomController', () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as { authSession?: { userId: string; teamId: string; exp: number } }).authSession = {
      userId: 'U123',
      teamId: 'T123',
      exp: Date.now() + 60000,
    };
    next();
  });
  app.use('/', bathroomController);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the current authenticated user and active timer', async () => {
    getUserBySlackIdMock.mockResolvedValue({
      slackId: 'U123',
      displayName: 'Alice',
      avatarUrl: 'https://example.com/alice.png',
    });
    getActiveTimerForSlackUserMock.mockResolvedValue({
      id: 9,
      startAt: new Date('2026-06-30T12:00:00.000Z'),
      endAt: null,
      durationSeconds: null,
    });

    const res = await request(app).get('/me');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: {
        slack_id: 'U123',
        display_name: 'Alice',
        avatar_url: 'https://example.com/alice.png',
      },
      active_timer: {
        id: 9,
        start_at: '2026-06-30T12:00:00.000Z',
        end_at: null,
        duration_seconds: null,
      },
    });
  });

  it('starts a timer for the authenticated user', async () => {
    startTimerMock.mockResolvedValue({
      id: 4,
      startAt: new Date('2026-06-30T12:00:00.000Z'),
      endAt: null,
      durationSeconds: null,
    });

    const res = await request(app).post('/timer/start');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: 4,
      start_at: '2026-06-30T12:00:00.000Z',
      end_at: null,
      duration_seconds: null,
    });
    expect(startTimerMock).toHaveBeenCalledWith('U123');
  });

  it('returns 409 when the user already has an active timer', async () => {
    startTimerMock.mockRejectedValue(new ActiveTimerExistsError());

    const res = await request(app).post('/timer/start');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Active timer already exists' });
  });

  it('stops an active timer for the authenticated user', async () => {
    stopTimerMock.mockResolvedValue({
      id: 4,
      startAt: new Date('2026-06-30T12:00:00.000Z'),
      endAt: new Date('2026-06-30T12:05:30.000Z'),
      durationSeconds: 330,
    });

    const res = await request(app).post('/timer/stop');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 4,
      start_at: '2026-06-30T12:00:00.000Z',
      end_at: '2026-06-30T12:05:30.000Z',
      duration_seconds: 330,
    });
  });

  it('returns 404 when no active timer exists to stop', async () => {
    stopTimerMock.mockRejectedValue(new ActiveTimerNotFoundError());

    const res = await request(app).post('/timer/stop');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Active timer not found' });
  });

  it('returns the daily leaderboard for a requested date', async () => {
    getLeaderboardForDateMock.mockResolvedValue([
      { slackId: 'U2', displayName: 'Bob', totalSeconds: 15 },
      { slackId: 'U1', displayName: 'Alice', totalSeconds: 45 },
    ]);

    const res = await request(app).get('/leaderboard').query({ date: '2026-06-30' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { slack_id: 'U2', display_name: 'Bob', total_seconds: 15 },
      { slack_id: 'U1', display_name: 'Alice', total_seconds: 45 },
    ]);
    expect(getLeaderboardForDateMock).toHaveBeenCalledWith(new Date('2026-06-30T00:00:00.000Z'));
  });

  it('returns 400 for an invalid leaderboard date', async () => {
    const res = await request(app).get('/leaderboard').query({ date: '06-30-2026' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'date must be provided as YYYY-MM-DD' });
  });
});
