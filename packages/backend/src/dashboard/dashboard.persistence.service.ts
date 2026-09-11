import { getRepository } from 'typeorm';
import type { Repository } from 'typeorm';
import { Message } from '../shared/db/models/Message';
import { logger } from '../shared/logger/logger';
import { logError } from '../shared/logger/error-logging';
import { RedisPersistenceService } from '../shared/services/redis.persistence.service';
import type {
  ActivityDataPoint,
  ChannelDataPoint,
  DashboardResponse,
  LeaderboardEntry,
  MyStats,
  RepLeaderboardEntry,
  SentimentDataPoint,
  TimePeriod,
} from './dashboard.model';
import { CACHE_TTL_MS, LEADERBOARD_LIMIT, PERIOD_DAYS, TOP_CHANNELS_LIMIT } from './dashboard.const';
export class DashboardPersistenceService {
  private logger = logger.child({ module: 'DashboardPersistenceService' });
  private redisService: RedisPersistenceService = RedisPersistenceService.getInstance();
  // Coalesces concurrent cache-miss requests for the same key into a single DB round trip so that
  // multiple users loading the dashboard at once (especially the team-wide leaderboard, which is
  // shared across all of a team's users) don't each trigger duplicate, expensive aggregate queries.
  private inFlightUserData = new Map<
    string,
    Promise<Pick<DashboardResponse, 'myStats' | 'myActivity' | 'myTopChannels' | 'mySentimentTrend'>>
  >();
  private inFlightLeaderboards = new Map<string, Promise<Pick<DashboardResponse, 'leaderboard' | 'repLeaderboard'>>>();

  async getDashboardData(userId: string, teamId: string, period: TimePeriod): Promise<DashboardResponse> {
    const userCacheKey = `dashboard:user:${teamId}:${userId}:${period}`;
    const leaderboardCacheKey = `dashboard:leaderboards:${teamId}:${period}`;

    let cachedUserData: Pick<
      DashboardResponse,
      'myStats' | 'myActivity' | 'myTopChannels' | 'mySentimentTrend'
    > | null = null;
    let cachedLeaderboards: Pick<DashboardResponse, 'leaderboard' | 'repLeaderboard'> | null = null;

    try {
      const cachedUser = await this.redisService.getValue(userCacheKey);
      if (cachedUser) {
        this.logger.info('dashboard user cache hit', { userId, teamId, period });
        const parsedUserData: Pick<DashboardResponse, 'myStats' | 'myActivity' | 'myTopChannels' | 'mySentimentTrend'> =
          JSON.parse(cachedUser);
        cachedUserData = parsedUserData;
      }

      const cachedTeamLeaderboards = await this.redisService.getValue(leaderboardCacheKey);
      if (cachedTeamLeaderboards) {
        this.logger.info('dashboard leaderboard cache hit', { teamId, period });
        const parsedLeaderboardData: Pick<DashboardResponse, 'leaderboard' | 'repLeaderboard'> =
          JSON.parse(cachedTeamLeaderboards);
        cachedLeaderboards = parsedLeaderboardData;
      }
    } catch (e: unknown) {
      logError(this.logger, 'Failed to read or parse dashboard cache', e, { userId, teamId, period });
      // Treat cache failures as a cache miss and continue to load data from the database.
    }

    if (cachedUserData && cachedLeaderboards) {
      return { ...cachedUserData, ...cachedLeaderboards };
    }

    const intervalDays = PERIOD_DAYS[period];
    const repo = getRepository(Message);

    let userData = cachedUserData;
    let leaderboards = cachedLeaderboards;

    try {
      [userData, leaderboards] = await Promise.all([
        userData ?? this.loadUserData(userCacheKey, repo, userId, teamId, intervalDays),
        leaderboards ?? this.loadLeaderboards(leaderboardCacheKey, repo, teamId, intervalDays),
      ]);
    } catch (e: unknown) {
      logError(this.logger, 'Failed to load dashboard data', e, { userId, teamId });
      throw e;
    }

    const data: DashboardResponse = { ...userData, ...leaderboards };
    try {
      await this.redisService.setValueWithExpire(userCacheKey, JSON.stringify(userData), 'PX', CACHE_TTL_MS[period]);
      await this.redisService.setValueWithExpire(
        leaderboardCacheKey,
        JSON.stringify(leaderboards),
        'PX',
        CACHE_TTL_MS[period],
      );
    } catch (e: unknown) {
      logError(this.logger, 'Failed to write dashboard data to cache', e, { userId, teamId, period });
    }
    return data;
  }

  private loadUserData(
    cacheKey: string,
    repo: Repository<Message>,
    userId: string,
    teamId: string,
    intervalDays: number | null,
  ): Promise<Pick<DashboardResponse, 'myStats' | 'myActivity' | 'myTopChannels' | 'mySentimentTrend'>> {
    const inFlight = this.inFlightUserData.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const request = Promise.all([
      this.getMyStats(repo, userId, teamId, intervalDays),
      this.getMyActivity(repo, userId, teamId, intervalDays),
      this.getMyTopChannels(repo, userId, teamId, intervalDays),
      this.getMySentimentTrend(repo, userId, teamId, intervalDays),
    ])
      .then(([myStats, myActivity, myTopChannels, mySentimentTrend]) => ({
        myStats,
        myActivity,
        myTopChannels,
        mySentimentTrend,
      }))
      .finally(() => this.inFlightUserData.delete(cacheKey));

    this.inFlightUserData.set(cacheKey, request);
    return request;
  }

  private loadLeaderboards(
    cacheKey: string,
    repo: Repository<Message>,
    teamId: string,
    intervalDays: number | null,
  ): Promise<Pick<DashboardResponse, 'leaderboard' | 'repLeaderboard'>> {
    const inFlight = this.inFlightLeaderboards.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const request = this.getLeaderboards(repo, teamId, intervalDays).finally(() =>
      this.inFlightLeaderboards.delete(cacheKey),
    );

    this.inFlightLeaderboards.set(cacheKey, request);
    return request;
  }

  private async getMyStats(
    repo: Repository<Message>,
    userId: string,
    teamId: string,
    intervalDays: number | null,
  ): Promise<MyStats> {
    const msgInterval = intervalDays !== null ? 'AND m.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)' : '';
    const reactionInterval = intervalDays !== null ? 'AND createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)' : '';
    const sentimentInterval = intervalDays !== null ? 'AND createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)' : '';

    const params: (string | number)[] = [userId, teamId];
    if (intervalDays !== null) params.push(intervalDays);
    params.push(userId, teamId);
    if (intervalDays !== null) params.push(intervalDays);
    params.push(userId, teamId);
    if (intervalDays !== null) params.push(intervalDays);

    const rows = await this.timeQuery('getMyStats', () =>
      repo.query<{ totalMessages: string; rep: string; avgSentiment: string | null }[]>(
        `SELECT
           (SELECT COUNT(*)
            FROM message m
            INNER JOIN slack_user u ON u.id = m.userIdId
            WHERE u.slackId = ? AND m.teamId = ? AND u.teamId = m.teamId AND m.channel LIKE 'C%'
            ${msgInterval}) AS totalMessages,
           (SELECT COALESCE(SUM(value), 0)
            FROM reaction
            WHERE affectedUser = ? AND teamId = ?
            ${reactionInterval}) AS rep,
           (SELECT AVG(sentiment)
            FROM sentiment
            WHERE userId = ? AND teamId = ?
            ${sentimentInterval}) AS avgSentiment`,
        params,
      ),
    );

    const row = rows[0];
    const avgRaw = row.avgSentiment;
    return {
      totalMessages: Number(row.totalMessages),
      rep: Number(row.rep),
      avgSentiment: avgRaw !== null ? Math.round(Number(avgRaw) * 100) / 100 : null,
    };
  }

  private async getMyActivity(
    repo: Repository<Message>,
    userId: string,
    teamId: string,
    intervalDays: number | null,
  ): Promise<ActivityDataPoint[]> {
    const intervalClause = intervalDays !== null ? 'AND m.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)' : '';
    const params: (string | number)[] = [userId, teamId];
    if (intervalDays !== null) params.push(intervalDays);

    const rows = await this.timeQuery('getMyActivity', () =>
      repo.query<{ date: string; count: string }[]>(
        `SELECT DATE(m.createdAt) AS date, COUNT(*) AS count
         FROM message m
         INNER JOIN slack_user u ON u.id = m.userIdId
         WHERE u.slackId = ? AND m.teamId = ? AND m.channel LIKE 'C%'
           ${intervalClause}
         GROUP BY DATE(m.createdAt)
         ORDER BY date ASC`,
        params,
      ),
    );
    return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
  }

  private async getMyTopChannels(
    repo: Repository<Message>,
    userId: string,
    teamId: string,
    intervalDays: number | null,
  ): Promise<ChannelDataPoint[]> {
    const intervalClause = intervalDays !== null ? 'AND m.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)' : '';
    const params: (string | number)[] = [userId, teamId];
    if (intervalDays !== null) params.push(intervalDays);
    params.push(TOP_CHANNELS_LIMIT);

    const rows = await this.timeQuery('getMyTopChannels', () =>
      repo.query<{ channel: string; count: string }[]>(
        `SELECT COALESCE(sc.name, m.channel) AS channel, COUNT(*) AS count
         FROM message m
         INNER JOIN slack_user u ON u.id = m.userIdId
         LEFT JOIN slack_channel sc ON sc.channelId = m.channel AND sc.teamId = m.teamId
         WHERE u.slackId = ? AND m.teamId = ? AND m.channel LIKE 'C%'
           ${intervalClause}
         GROUP BY m.channel, sc.name
         ORDER BY count DESC
         LIMIT ?`,
        params,
      ),
    );
    return rows.map((r) => ({ channel: r.channel, count: Number(r.count) }));
  }

  private async getMySentimentTrend(
    repo: Repository<Message>,
    userId: string,
    teamId: string,
    intervalDays: number | null,
  ): Promise<SentimentDataPoint[]> {
    const intervalClause = intervalDays !== null ? 'AND createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)' : '';
    const params: (string | number)[] = [userId, teamId];
    if (intervalDays !== null) params.push(intervalDays);

    const rows = await this.timeQuery('getMySentimentTrend', () =>
      repo.query<{ weekStart: string; avgSentiment: string }[]>(
        `SELECT MIN(DATE(createdAt)) AS weekStart,
                ROUND(AVG(sentiment), 2) AS avgSentiment
         FROM sentiment
         WHERE userId = ? AND teamId = ?
           ${intervalClause}
         GROUP BY YEARWEEK(createdAt, 3)
         ORDER BY weekStart ASC`,
        params,
      ),
    );
    return rows.map((r) => ({
      weekStart: r.weekStart,
      avgSentiment: Number(r.avgSentiment),
    }));
  }

  private async getLeaderboards(
    repo: Repository<Message>,
    teamId: string,
    intervalDays: number | null,
  ): Promise<{ leaderboard: LeaderboardEntry[]; repLeaderboard: RepLeaderboardEntry[] }> {
    const activityInterval = intervalDays !== null ? 'AND m.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)' : '';
    const repInterval = intervalDays !== null ? 'AND r.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)' : '';

    const activityParams: (string | number)[] = [teamId];
    if (intervalDays !== null) activityParams.push(intervalDays);
    activityParams.push(LEADERBOARD_LIMIT);

    const repParams: (string | number)[] = [teamId];
    if (intervalDays !== null) repParams.push(intervalDays);
    repParams.push(LEADERBOARD_LIMIT);

    const activityRowsPromise = this.timeQuery('getLeaderboards:activity', () =>
      repo.query<{ name: string; value: string }[]>(
        `SELECT u.name AS name, CAST(COUNT(*) AS SIGNED) AS value
         FROM message m
         INNER JOIN slack_user u ON u.id = m.userIdId
         WHERE m.teamId = ? AND u.isBot = 0 AND m.channel LIKE 'C%'
           ${activityInterval}
         GROUP BY u.slackId, u.name
         ORDER BY value DESC
         LIMIT ?`,
        activityParams,
      ),
    );

    const repRowsPromise = this.timeQuery('getLeaderboards:rep', () =>
      repo.query<{ name: string; value: string }[]>(
        `SELECT u.name AS name, CAST(SUM(r.value) AS SIGNED) AS value
         FROM reaction r
         INNER JOIN slack_user u ON u.slackId = r.affectedUser AND u.teamId = r.teamId
         WHERE r.teamId = ?
           ${repInterval}
         GROUP BY r.affectedUser, u.name
         ORDER BY value DESC
         LIMIT ?`,
        repParams,
      ),
    );

    const [activityRows, repRows] = await Promise.all([activityRowsPromise, repRowsPromise]);

    return {
      leaderboard: activityRows.map((r) => ({ name: r.name, count: Number(r.value) })),
      repLeaderboard: repRows.map((r) => ({ name: r.name, rep: Number(r.value) })),
    };
  }

  private async timeQuery<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const result = await fn();
    this.logger.info('query profile', { query: label, durationMs: Date.now() - start });
    return result;
  }
}
