import { getRepository } from 'typeorm';
import type { Repository } from 'typeorm';
import { Message } from '../shared/db/models/Message';
import { logger } from '../shared/logger/logger';
import { logError } from '../shared/logger/error-logging';
import type {
  ActivityDataPoint,
  ChannelDataPoint,
  DashboardResponse,
  LeaderboardEntry,
  MyStats,
  RepLeaderboardEntry,
  SentimentDataPoint,
} from './dashboard.model';
import { ACTIVITY_DAYS, SENTIMENT_WEEKS, TOP_CHANNELS_LIMIT, LEADERBOARD_LIMIT } from './dashboard.const';
export class DashboardPersistenceService {
  private logger = logger.child({ module: 'DashboardPersistenceService' });

  async getDashboardData(userId: string, teamId: string): Promise<DashboardResponse> {
    const repo = getRepository(Message);

    const [myStats, myActivity, myTopChannels, mySentimentTrend, leaderboards] = await Promise.all([
      this.getMyStats(repo, userId, teamId),
      this.getMyActivity(repo, userId, teamId),
      this.getMyTopChannels(repo, userId, teamId),
      this.getMySentimentTrend(repo, userId, teamId),
      this.getLeaderboards(repo, teamId),
    ]).catch((e: unknown) => {
      logError(this.logger, 'Failed to load dashboard data', e, { userId, teamId });
      throw e;
    });

    return { myStats, myActivity, myTopChannels, mySentimentTrend, ...leaderboards };
  }

  private async getMyStats(repo: Repository<Message>, userId: string, teamId: string): Promise<MyStats> {
    const rows = await repo.query<{ totalMessages: string; rep: string; avgSentiment: string | null }[]>(
      `SELECT
         (SELECT COUNT(*)
          FROM message m
          INNER JOIN slack_user u ON u.id = m.userIdId
          WHERE u.slackId = ? AND m.teamId = ? AND u.teamId = m.teamId AND m.channel LIKE 'C%') AS totalMessages,
         (SELECT COALESCE(SUM(value), 0)
          FROM reaction
          WHERE affectedUser = ? AND teamId = ?) AS rep,
         (SELECT AVG(sentiment)
          FROM sentiment
          WHERE userId = ? AND teamId = ?) AS avgSentiment`,
      [userId, teamId, userId, teamId, userId, teamId],
    );

    const row = rows[0];
    const avgRaw = row.avgSentiment;
    return {
      totalMessages: Number(row.totalMessages),
      rep: Number(row.rep),
      avgSentiment: avgRaw !== null ? Math.round(Number(avgRaw) * 100) / 100 : null,
    };
  }

  private async getMyActivity(repo: Repository<Message>, userId: string, teamId: string): Promise<ActivityDataPoint[]> {
    const rows = await repo.query<{ date: string; count: string }[]>(
      `SELECT DATE(m.createdAt) AS date, COUNT(*) AS count
       FROM message m
       INNER JOIN slack_user u ON u.id = m.userIdId
       WHERE u.slackId = ? AND m.teamId = ? AND m.channel LIKE 'C%'
         AND m.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(m.createdAt)
       ORDER BY date ASC`,
      [userId, teamId, ACTIVITY_DAYS],
    );
    return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
  }

  private async getMyTopChannels(
    repo: Repository<Message>,
    userId: string,
    teamId: string,
  ): Promise<ChannelDataPoint[]> {
    const rows = await repo.query<{ channel: string; count: string }[]>(
      `SELECT COALESCE(sc.name, m.channel) AS channel, COUNT(*) AS count
       FROM message m
       INNER JOIN slack_user u ON u.id = m.userIdId
       LEFT JOIN slack_channel sc ON sc.channelId = m.channel AND sc.teamId = m.teamId
       WHERE u.slackId = ? AND m.teamId = ? AND m.channel LIKE 'C%'
       GROUP BY m.channel, sc.name
       ORDER BY count DESC
       LIMIT ?`,
      [userId, teamId, TOP_CHANNELS_LIMIT],
    );
    return rows.map((r) => ({ channel: r.channel, count: Number(r.count) }));
  }

  private async getMySentimentTrend(
    repo: Repository<Message>,
    userId: string,
    teamId: string,
  ): Promise<SentimentDataPoint[]> {
    const rows = await repo.query<{ weekStart: string; avgSentiment: string }[]>(
      `SELECT MIN(DATE(createdAt)) AS weekStart,
              ROUND(AVG(sentiment), 2) AS avgSentiment
       FROM sentiment
       WHERE userId = ? AND teamId = ?
         AND createdAt >= DATE_SUB(NOW(), INTERVAL ? WEEK)
       GROUP BY YEARWEEK(createdAt, 3)
       ORDER BY weekStart ASC`,
      [userId, teamId, SENTIMENT_WEEKS],
    );
    return rows.map((r) => ({
      weekStart: r.weekStart,
      avgSentiment: Number(r.avgSentiment),
    }));
  }

  private async getLeaderboards(
    repo: Repository<Message>,
    teamId: string,
  ): Promise<{ leaderboard: LeaderboardEntry[]; repLeaderboard: RepLeaderboardEntry[] }> {
    const rows = await repo.query<{ type: 'activity' | 'rep'; name: string; value: string }[]>(
      `(SELECT 'activity' AS type, u.name AS name, CAST(COUNT(*) AS SIGNED) AS value
        FROM message m
        INNER JOIN slack_user u ON u.id = m.userIdId
        WHERE m.teamId = ? AND u.isBot = 0 AND m.channel LIKE 'C%'
        GROUP BY u.slackId, u.name
        ORDER BY value DESC
        LIMIT ?)
       UNION ALL
       (SELECT 'rep' AS type, u.name AS name, CAST(SUM(r.value) AS SIGNED) AS value
        FROM reaction r
        INNER JOIN slack_user u ON u.slackId = r.affectedUser AND u.teamId = r.teamId
        WHERE r.teamId = ?
        GROUP BY r.affectedUser, u.name
        ORDER BY value DESC
        LIMIT ?)`,
      [teamId, LEADERBOARD_LIMIT, teamId, LEADERBOARD_LIMIT],
    );

    const { leaderboard, repLeaderboard } = rows.reduce<{
      leaderboard: LeaderboardEntry[];
      repLeaderboard: RepLeaderboardEntry[];
    }>(
      (acc, r) => {
        switch (r.type) {
          case 'activity':
            acc.leaderboard.push({ name: r.name, count: Number(r.value) });
            break;
          case 'rep':
            acc.repLeaderboard.push({ name: r.name, rep: Number(r.value) });
            break;
          default: {
            const exhaustive: never = r.type;
            throw new Error(`Unexpected leaderboard type: ${exhaustive}`);
          }
        }
        return acc;
      },
      { leaderboard: [], repLeaderboard: [] },
    );
    leaderboard.sort((a, b) => b.count - a.count);
    repLeaderboard.sort((a, b) => b.rep - a.rep);
    return { leaderboard, repLeaderboard };
  }
}
