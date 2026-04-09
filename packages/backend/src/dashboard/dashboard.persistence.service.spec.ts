import { vi } from 'vitest';
import { getRepository } from 'typeorm';
import { loggerMock } from '../test/mocks/logger.mock';
import { DashboardPersistenceService } from './dashboard.persistence.service';
import { LEADERBOARD_LIMIT, PERIOD_DAYS, TOP_CHANNELS_LIMIT } from './dashboard.const';

vi.mock('typeorm', async () => {
  const actual = await vi.importActual('typeorm');
  return {
    ...actual,
    getRepository: vi.fn(),
  };
});

describe('DashboardPersistenceService', () => {
  let service: DashboardPersistenceService;
  const query = vi.fn();

  const redis = {
    getValue: vi.fn(),
    setValueWithExpire: vi.fn(),
  };

  /** Route mock query responses by SQL content so parallel calls resolve correctly. */
  function routeQuery(sql: string): Promise<unknown[]> {
    if (sql.includes('totalMessages'))
      return Promise.resolve([{ totalMessages: '5', rep: '10', avgSentiment: '0.75' }]);
    if (sql.includes('DATE(m.createdAt) AS date')) return Promise.resolve([]);
    if (sql.includes('AS channel')) return Promise.resolve([]);
    if (sql.includes('ROUND(AVG(sentiment)')) return Promise.resolve([]);
    if (sql.includes('isBot = 0')) return Promise.resolve([]);
    if (sql.includes('SUM(r.value)')) return Promise.resolve([]);
    return Promise.resolve([]);
  }

  beforeEach(() => {
    vi.resetAllMocks();
    service = new DashboardPersistenceService();
    (getRepository as Mock).mockReturnValue({ query });
    query.mockImplementation(routeQuery);
    redis.getValue.mockResolvedValue(null);
    redis.setValueWithExpire.mockResolvedValue('OK');
    type DashboardServiceDependencies = DashboardPersistenceService & {
      redisService: typeof redis;
    };
    (service as unknown as DashboardServiceDependencies).redisService = redis;
  });

  it('returns a complete DashboardResponse with the expected shape', async () => {
    const result = await service.getDashboardData('U1', 'T1', 'weekly');
    expect(result).toMatchObject({
      myStats: { totalMessages: 5, rep: 10, avgSentiment: 0.75 },
      myActivity: [],
      myTopChannels: [],
      mySentimentTrend: [],
      leaderboard: [],
      repLeaderboard: [],
    });
  });

  it('converts string counts and rep values from DB rows to numbers', async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes('totalMessages'))
        return Promise.resolve([{ totalMessages: '42', rep: '7', avgSentiment: null }]);
      if (sql.includes('DATE(m.createdAt) AS date')) return Promise.resolve([{ date: '2024-01-01', count: '3' }]);
      if (sql.includes('AS channel')) return Promise.resolve([{ channel: 'general', count: '9' }]);
      if (sql.includes('ROUND(AVG(sentiment)'))
        return Promise.resolve([{ weekStart: '2024-01-01', avgSentiment: '0.5' }]);
      if (sql.includes('isBot = 0')) return Promise.resolve([{ name: 'alice', value: '100' }]);
      if (sql.includes('SUM(r.value)')) return Promise.resolve([{ name: 'bob', value: '50' }]);
      return Promise.resolve([]);
    });

    const result = await service.getDashboardData('U1', 'T1', 'weekly');

    expect(result.myStats.totalMessages).toBe(42);
    expect(result.myStats.rep).toBe(7);
    expect(result.myStats.avgSentiment).toBeNull();
    expect(result.myActivity).toEqual([{ date: '2024-01-01', count: 3 }]);
    expect(result.myTopChannels).toEqual([{ channel: 'general', count: 9 }]);
    expect(result.mySentimentTrend).toEqual([{ weekStart: '2024-01-01', avgSentiment: 0.5 }]);
    expect(result.leaderboard).toEqual([{ name: 'alice', count: 100 }]);
    expect(result.repLeaderboard).toEqual([{ name: 'bob', rep: 50 }]);
  });

  it('returns null avgSentiment when the sentiment table has no rows', async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes('totalMessages'))
        return Promise.resolve([{ totalMessages: '5', rep: '10', avgSentiment: null }]);
      return routeQuery(sql);
    });

    const result = await service.getDashboardData('U1', 'T1', 'weekly');
    expect(result.myStats.avgSentiment).toBeNull();
  });

  it('returns null avgSentiment when AVG returns null (no sentiment rows for user)', async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes('totalMessages'))
        return Promise.resolve([{ totalMessages: '5', rep: '10', avgSentiment: null }]);
      return routeQuery(sql);
    });

    const result = await service.getDashboardData('U1', 'T1', 'weekly');
    expect(result.myStats.avgSentiment).toBeNull();
  });

  it('scopes all message queries to the given teamId', async () => {
    await service.getDashboardData('U1', 'T42', 'weekly');

    const calls = (query as Mock).mock.calls as [string, unknown[]][];
    const teamScopedCalls = calls.filter(([sql]) => sql.includes('teamId'));
    expect(teamScopedCalls.length).toBeGreaterThan(0);
    teamScopedCalls.forEach(([, params]) => {
      expect(params).toContain('T42');
    });
  });

  it('scopes user queries to the given userId', async () => {
    await service.getDashboardData('U99', 'T1', 'weekly');

    // At least the stats, activity, top-channels, and sentiment-trend queries bind userId.
    const calls = (query as Mock).mock.calls as [string, unknown[]][];
    const userScopedCalls = calls.filter(([, params]) => (params as unknown[]).includes('U99'));
    expect(userScopedCalls.length).toBeGreaterThan(0);
  });

  it('passes the period interval as the window for the activity query', async () => {
    await service.getDashboardData('U1', 'T1', 'monthly');

    const calls = (query as Mock).mock.calls as [string, unknown[]][];
    const activityCall = calls.find(([sql]) => sql.includes('DATE(m.createdAt) AS date'));
    expect(activityCall).toBeDefined();
    expect(activityCall![1]).toContain(PERIOD_DAYS['monthly']);
  });

  it('passes the period interval as the window for the sentiment trend query', async () => {
    await service.getDashboardData('U1', 'T1', 'monthly');

    const calls = (query as Mock).mock.calls as [string, unknown[]][];
    const sentimentCall = calls.find(([sql]) => sql.includes('ROUND(AVG(sentiment)'));
    expect(sentimentCall).toBeDefined();
    expect(sentimentCall![1]).toContain(PERIOD_DAYS['monthly']);
  });

  it('does not include a date interval in queries for the allTime period', async () => {
    await service.getDashboardData('U1', 'T1', 'allTime');

    const calls = (query as Mock).mock.calls as [string, unknown[]][];
    const activityCall = calls.find(([sql]) => sql.includes('DATE(m.createdAt) AS date'));
    expect(activityCall).toBeDefined();
    expect(activityCall![1]).not.toContain(null);
    expect(activityCall![1]).toHaveLength(2); // only userId and teamId
  });

  it('passes TOP_CHANNELS_LIMIT as the LIMIT for the top channels query', async () => {
    await service.getDashboardData('U1', 'T1', 'weekly');

    const calls = (query as Mock).mock.calls as [string, unknown[]][];
    const channelsCall = calls.find(([sql]) => sql.includes('AS channel'));
    expect(channelsCall).toBeDefined();
    expect(channelsCall![1]).toContain(TOP_CHANNELS_LIMIT);
  });

  it('passes LEADERBOARD_LIMIT as the LIMIT for both leaderboard queries', async () => {
    await service.getDashboardData('U1', 'T1', 'weekly');

    const calls = (query as Mock).mock.calls as [string, unknown[]][];
    const leaderboardCalls = calls.filter(([sql]) => sql.includes('isBot = 0') || sql.includes('SUM(r.value)'));
    expect(leaderboardCalls).toHaveLength(2);
    leaderboardCalls.forEach(([, params]) => {
      expect(params).toContain(LEADERBOARD_LIMIT);
    });
  });

  it('excludes bot users from the activity leaderboard query', async () => {
    await service.getDashboardData('U1', 'T1', 'weekly');

    const calls = (query as Mock).mock.calls as [string, unknown[]][];
    const leaderboardCall = calls.find(([sql]) => sql.includes('isBot = 0'));
    expect(leaderboardCall).toBeDefined();
    expect(leaderboardCall![0]).toContain('isBot = 0');
  });

  it('issues separate queries for activity and rep leaderboards, both with ORDER BY value DESC', async () => {
    await service.getDashboardData('U1', 'T1', 'weekly');

    const calls = (query as Mock).mock.calls as [string, unknown[]][];
    const activityCall = calls.find(([sql]) => sql.includes('isBot = 0'));
    const repCall = calls.find(([sql]) => sql.includes('SUM(r.value)'));
    expect(activityCall![0]).toContain('ORDER BY value DESC');
    expect(repCall![0]).toContain('ORDER BY value DESC');
  });

  it('logs a debug profile entry for each of the 6 queries', async () => {
    await service.getDashboardData('U1', 'T1', 'weekly');

    expect(loggerMock.info).toHaveBeenCalledWith(
      'query profile',
      expect.objectContaining({ query: 'getMyStats', durationMs: expect.any(Number) }),
    );
    for (const label of [
      'getMyStats',
      'getMyActivity',
      'getMyTopChannels',
      'getMySentimentTrend',
      'getLeaderboards:activity',
      'getLeaderboards:rep',
    ]) {
      expect(loggerMock.info).toHaveBeenCalledWith(
        'query profile',
        expect.objectContaining({ query: label, durationMs: expect.any(Number) }),
      );
    }
  });

  it('propagates errors thrown by repo.query through getDashboardData', async () => {
    query.mockRejectedValue(new Error('DB connection lost'));

    await expect(service.getDashboardData('U1', 'T1', 'weekly')).rejects.toThrow('DB connection lost');
  });

  it('returns cached data without querying the DB on a cache hit', async () => {
    const cachedData = {
      myStats: { totalMessages: 99, rep: 42, avgSentiment: 0.5 },
      myActivity: [],
      myTopChannels: [],
      mySentimentTrend: [],
      leaderboard: [],
      repLeaderboard: [],
    };
    redis.getValue.mockResolvedValue(JSON.stringify(cachedData));

    const result = await service.getDashboardData('U1', 'T1', 'weekly');

    expect(result).toEqual(cachedData);
    expect(query).not.toHaveBeenCalled();
  });

  it('stores the result in Redis after a cache miss', async () => {
    redis.getValue.mockResolvedValue(null);

    await service.getDashboardData('U1', 'T1', 'weekly');

    expect(redis.setValueWithExpire).toHaveBeenCalledWith(
      'dashboard:user:T1:U1:weekly',
      expect.any(String),
      'PX',
      expect.any(Number),
    );
    expect(redis.setValueWithExpire).toHaveBeenCalledWith(
      'dashboard:leaderboards:T1:weekly',
      expect.any(String),
      'PX',
      expect.any(Number),
    );
    const stored = JSON.parse((redis.setValueWithExpire.mock.calls[0] as unknown[])[1] as string) as object;
    expect(stored).toMatchObject({ myStats: { totalMessages: 5 } });
  });

  it('uses user-scoped and team-scoped cache keys', async () => {
    redis.getValue.mockResolvedValue(null);

    await service.getDashboardData('U7', 'T3', 'yearly');

    expect(redis.getValue).toHaveBeenCalledWith('dashboard:user:T3:U7:yearly');
    expect(redis.getValue).toHaveBeenCalledWith('dashboard:leaderboards:T3:yearly');
    expect(redis.setValueWithExpire).toHaveBeenCalledWith(
      'dashboard:user:T3:U7:yearly',
      expect.any(String),
      'PX',
      expect.any(Number),
    );
    expect(redis.setValueWithExpire).toHaveBeenCalledWith(
      'dashboard:leaderboards:T3:yearly',
      expect.any(String),
      'PX',
      expect.any(Number),
    );
  });

  it('returns merged payload from split cache entries without querying DB', async () => {
    redis.getValue.mockImplementation((key: string) => {
      if (key === 'dashboard:user:T1:U1:weekly') {
        return Promise.resolve(
          JSON.stringify({
            myStats: { totalMessages: 10, rep: 20, avgSentiment: 0.8 },
            myActivity: [],
            myTopChannels: [],
            mySentimentTrend: [],
          }),
        );
      }
      if (key === 'dashboard:leaderboards:T1:weekly') {
        return Promise.resolve(JSON.stringify({ leaderboard: [{ name: 'alice', count: 1 }], repLeaderboard: [] }));
      }
      return Promise.resolve(null);
    });

    const result = await service.getDashboardData('U1', 'T1', 'weekly');

    expect(query).not.toHaveBeenCalled();
    expect(result).toEqual({
      myStats: { totalMessages: 10, rep: 20, avgSentiment: 0.8 },
      myActivity: [],
      myTopChannels: [],
      mySentimentTrend: [],
      leaderboard: [{ name: 'alice', count: 1 }],
      repLeaderboard: [],
    });
  });
});
