import { getRepository } from 'typeorm';
import { Message } from '../shared/db/models/Message';
import { SlackUser } from '../shared/db/models/SlackUser';
import { SlackChannel } from '../shared/db/models/SlackChannel';

export interface SearchFilters {
  teamId: string;
  query?: string;
  userId?: number;
  channelId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface MessageSearchResult {
  id: number;
  message: string;
  createdAt: Date;
  teamId: string;
  channel: string;
  userName: string;
  userSlackId: string;
  channelName: string | null;
}

export interface SearchResults {
  messages: MessageSearchResult[];
  total: number;
  limit: number;
  offset: number;
}

export class SearchPersistenceService {
  async searchMessages(filters: SearchFilters): Promise<SearchResults> {
    const { teamId, query, userId, channelId, startDate, endDate, limit = 20, offset = 0 } = filters;

    const params: (string | number | Date)[] = [];
    const conditions: string[] = ['message.teamId = ?'];
    params.push(teamId);

    if (query && query.trim()) {
      conditions.push('message.message LIKE ?');
      params.push(`%${query.trim()}%`);
    }

    if (userId !== undefined) {
      conditions.push('message.userIdId = ?');
      params.push(userId);
    }

    if (channelId) {
      conditions.push('message.channel = ?');
      params.push(channelId);
    }

    if (startDate) {
      conditions.push('message.createdAt >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('message.createdAt <= ?');
      params.push(endDate);
    }

    const whereClause = conditions.join(' AND ');

    const countQuery = `
      SELECT COUNT(*) as total
      FROM message
      WHERE ${whereClause}
    `;

    const countResult = await getRepository(Message).query(countQuery, params);
    const total = parseInt(countResult[0]?.total || '0', 10);

    const searchQuery = `
      SELECT
        message.id,
        message.message,
        message.createdAt,
        message.teamId,
        message.channel,
        slack_user.name as userName,
        slack_user.slackId as userSlackId,
        slack_channel.name as channelName
      FROM message
      INNER JOIN slack_user ON slack_user.id = message.userIdId
      LEFT JOIN slack_channel ON slack_channel.channelId = message.channel
        AND slack_channel.teamId = message.teamId
      WHERE ${whereClause}
      ORDER BY message.createdAt DESC
      LIMIT ? OFFSET ?
    `;

    const messages = await getRepository(Message).query(searchQuery, [...params, limit, offset]);

    return {
      messages,
      total,
      limit,
      offset,
    };
  }

  async getUsers(teamId: string): Promise<Pick<SlackUser, 'id' | 'slackId' | 'name'>[]> {
    return getRepository(SlackUser)
      .createQueryBuilder('slack_user')
      .select(['slack_user.id', 'slack_user.slackId', 'slack_user.name'])
      .where('slack_user.teamId = :teamId', { teamId })
      .andWhere('slack_user.isBot = :isBot', { isBot: false })
      .orderBy('slack_user.name', 'ASC')
      .getMany();
  }

  async getChannels(teamId: string): Promise<Pick<SlackChannel, 'id' | 'channelId' | 'name'>[]> {
    return getRepository(SlackChannel)
      .createQueryBuilder('slack_channel')
      .select(['slack_channel.id', 'slack_channel.channelId', 'slack_channel.name'])
      .where('slack_channel.teamId = :teamId', { teamId })
      .orderBy('slack_channel.name', 'ASC')
      .getMany();
  }

  async getUserBySlackId(slackId: string, teamId: string): Promise<SlackUser | null> {
    return getRepository(SlackUser).findOne({
      where: { slackId, teamId },
    });
  }
}
