import { getRepository } from 'typeorm';
import { loggerMock } from '../test/mocks/logger.mock';
import { DashboardPersistenceService } from './dashboard.persistence.service';
import { ACTIVITY_DAYS, LEADERBOARD_LIMIT, SENTIMENT_WEEKS, TOP_CHANNELS_LIMIT } from './dashboard.const';

jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    getRepository: jest.fn(),
  };
});

describe('DashboardPersistenceService', () => {
  let service: DashboardPersistenceService;
  const query = jest.fn();

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
    jest.resetAllMocks();
    service = new DashboardPersistenceService();
    (getRepository as jest.Mock).mockReturnValue({ query });
    query.mockImplementation(routeQuery);
  });

  it('returns a complete DashboardResponse with the expected shape', async () => {
    const result = await service.getDashboardData('U1', 'T1');
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

    const result = await service.getDashboardData('U1', 'T1');

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

    const result = await service.getDashboardData('U1', 'T1');
    expect(result.myStats.avgSentiment).toBeNull();
  });

  it('returns null avgSentiment when AVG returns null (no sentiment rows for user)', async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes('totalMessages'))
        return Promise.resolve([{ totalMessages: '5', rep: '10', avgSentiment: null }]);
      return routeQuery(sql);
    });

    const result = await service.getDashboardData('U1', 'T1');
    expect(result.myStats.avgSentiment).toBeNull();
  });

  it('scopes all message queries to the given teamId', async () => {
    await service.getDashboardData('U1', 'T42');

    const calls = (query as jest.Mock).mock.calls as [string, unknown[]][];
    const teamScopedCalls = calls.filter(([sql]) => sql.includes('teamId'));
    expect(teamScopedCalls.length).toBeGreaterThan(0);
    teamScopedCalls.forEach(([, params]) => {
      expect(params).toContain('T42');
    });
  });

  it('scopes user queries to the given userId', async () => {
    await service.getDashboardData('U99', 'T1');

    // At least the stats, activity, top-channels, and sentiment-trend queries bind userId.
    const calls = (query as jest.Mock).mock.calls as [string, unknown[]][];
    const userScopedCalls = calls.filter(([, params]) => (params as unknown[]).includes('U99'));
    expect(userScopedCalls.length).toBeGreaterThan(0);
  });

  it('passes ACTIVITY_DAYS as the window for the activity query', async () => {
    await service.getDashboardData('U1', 'T1');

    const calls = (query as jest.Mock).mock.calls as [string, unknown[]][];
    const activityCall = calls.find(([sql]) => sql.includes('DATE(m.createdAt) AS date'));
    expect(activityCall).toBeDefined();
    expect(activityCall![1]).toContain(ACTIVITY_DAYS);
  });

  it('passes SENTIMENT_WEEKS as the window for the sentiment trend query', async () => {
    await service.getDashboardData('U1', 'T1');

    const calls = (query as jest.Mock).mock.calls as [string, unknown[]][];
    const sentimentCall = calls.find(([sql]) => sql.includes('ROUND(AVG(sentiment)'));
    expect(sentimentCall).toBeDefined();
    expect(sentimentCall![1]).toContain(SENTIMENT_WEEKS);
  });

  it('passes TOP_CHANNELS_LIMIT as the LIMIT for the top channels query', async () => {
    await service.getDashboardData('U1', 'T1');

    const calls = (query as jest.Mock).mock.calls as [string, unknown[]][];
    const channelsCall = calls.find(([sql]) => sql.includes('AS channel'));
    expect(channelsCall).toBeDefined();
    expect(channelsCall![1]).toContain(TOP_CHANNELS_LIMIT);
  });

  it('passes LEADERBOARD_LIMIT as the LIMIT for both leaderboard queries', async () => {
    await service.getDashboardData('U1', 'T1');

    const calls = (query as jest.Mock).mock.calls as [string, unknown[]][];
    const leaderboardCalls = calls.filter(([sql]) => sql.includes('isBot = 0') || sql.includes('SUM(r.value)'));
    expect(leaderboardCalls).toHaveLength(2);
    leaderboardCalls.forEach(([, params]) => {
      expect(params).toContain(LEADERBOARD_LIMIT);
    });
  });

  it('excludes bot users from the activity leaderboard query', async () => {
    await service.getDashboardData('U1', 'T1');

    const calls = (query as jest.Mock).mock.calls as [string, unknown[]][];
    const leaderboardCall = calls.find(([sql]) => sql.includes('isBot = 0'));
    expect(leaderboardCall).toBeDefined();
    expect(leaderboardCall![0]).toContain('isBot = 0');
  });

  it('issues separate queries for activity and rep leaderboards, both with ORDER BY value DESC', async () => {
    await service.getDashboardData('U1', 'T1');

    const calls = (query as jest.Mock).mock.calls as [string, unknown[]][];
    const activityCall = calls.find(([sql]) => sql.includes('isBot = 0'));
    const repCall = calls.find(([sql]) => sql.includes('SUM(r.value)'));
    expect(activityCall![0]).toContain('ORDER BY value DESC');
    expect(repCall![0]).toContain('ORDER BY value DESC');
  });

  it('logs a debug profile entry for each of the 6 queries', async () => {
    await service.getDashboardData('U1', 'T1');

    expect(loggerMock.debug).toHaveBeenCalledTimes(6);
    for (const label of [
      'getMyStats',
      'getMyActivity',
      'getMyTopChannels',
      'getMySentimentTrend',
      'getLeaderboards:activity',
      'getLeaderboards:rep',
    ]) {
      expect(loggerMock.debug).toHaveBeenCalledWith(
        'query profile',
        expect.objectContaining({ query: label, durationMs: expect.any(Number) }),
      );
    }
  });

  it('propagates errors thrown by repo.query through getDashboardData', async () => {
    query.mockRejectedValue(new Error('DB connection lost'));

    await expect(service.getDashboardData('U1', 'T1')).rejects.toThrow('DB connection lost');
  });
});
