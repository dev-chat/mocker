import { getRepository } from 'typeorm';
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
import {
  ACTIVITY_DAYS,
  SENTIMENT_WEEKS,
  TOP_CHANNELS_LIMIT,
  LEADERBOARD_LIMIT,
} from './dashboard.const';
export class DashboardPersistenceService {
  private logger = logger.child({ module: 'DashboardPersistenceService' });

  async getDashboardData(userId: string, teamId: string): Promise<DashboardResponse> {
    const repo = getRepository(Message);

    const [myStats, myActivity, myTopChannels, mySentimentTrend, leaderboard, repLeaderboard] = await Promise.all([
      this.getMyStats(repo, userId, teamId),
      this.getMyActivity(repo, userId, teamId),
      this.getMyTopChannels(repo, userId, teamId),
      this.getMySentimentTrend(repo, userId, teamId),
      this.getLeaderboard(repo, teamId),
      this.getRepLeaderboard(repo, teamId),
    ]).catch((e: unknown) => {
      logError(this.logger, 'Failed to load dashboard data', e, { userId, teamId });
      throw e;
    });

    return { myStats, myActivity, myTopChannels, mySentimentTrend, leaderboard, repLeaderboard };
  }

  private async getMyStats(
    repo: ReturnType<typeof getRepository<Message>>,
    userId: string,
    teamId: string,
  ): Promise<MyStats> {
    const [msgRows, repRows, sentimentRows] = await Promise.all([
      repo.query<{ total: string }[]>(
        `SELECT COUNT(*) AS total
         FROM message m
         INNER JOIN slack_user u ON u.id = m.userIdId
         WHERE u.slackId = ? AND m.teamId = ? AND u.teamId = m.teamId AND m.channel LIKE 'C%'`,
        [userId, teamId],
      ),
      repo.query<{ rep: string }[]>(
        `SELECT COALESCE(SUM(value), 0) AS rep
         FROM reaction
         WHERE affectedUser = ? AND teamId = ?`,
        [userId, teamId],
      ),
      repo.query<{ avg: string | null }[]>(
        `SELECT AVG(sentiment) AS avg
         FROM sentiment
         WHERE userId = ? AND teamId = ?`,
        [userId, teamId],
      ),
    ]);

    const avgRaw = sentimentRows[0]?.avg;
    return {
      totalMessages: Number(msgRows[0]?.total ?? 0),
      rep: Number(repRows[0]?.rep ?? 0),
      avgSentiment: avgRaw != null ? Math.round(Number(avgRaw) * 100) / 100 : null,
    };
  }

  private async getMyActivity(
    repo: ReturnType<typeof getRepository<Message>>,
    userId: string,
    teamId: string,
  ): Promise<ActivityDataPoint[]> {
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
    repo: ReturnType<typeof getRepository<Message>>,
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
    repo: ReturnType<typeof getRepository<Message>>,
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

  private async getLeaderboard(
    repo: ReturnType<typeof getRepository<Message>>,
    teamId: string,
  ): Promise<LeaderboardEntry[]> {
    const rows = await repo.query<{ name: string; count: string }[]>(
      `SELECT u.name, COUNT(*) AS count
       FROM message m
       INNER JOIN slack_user u ON u.id = m.userIdId
       WHERE m.teamId = ? AND u.isBot = 0 AND m.channel LIKE 'C%'
       GROUP BY u.slackId, u.name
       ORDER BY count DESC
       LIMIT ?`,
      [teamId, LEADERBOARD_LIMIT],
    );
    return rows.map((r) => ({ name: r.name, count: Number(r.count) }));
  }

  private async getRepLeaderboard(
    repo: ReturnType<typeof getRepository<Message>>,
    teamId: string,
  ): Promise<RepLeaderboardEntry[]> {
    const rows = await repo.query<{ name: string; rep: string }[]>(
      `SELECT u.name, SUM(r.value) AS rep
       FROM reaction r
       INNER JOIN slack_user u ON u.slackId = r.affectedUser AND u.teamId = r.teamId
       WHERE r.teamId = ?
       GROUP BY r.affectedUser, u.name
       ORDER BY rep DESC
       LIMIT ?`,
      [teamId, LEADERBOARD_LIMIT],
    );
    return rows.map((r) => ({ name: r.name, rep: Number(r.rep) }));
  }
}
