import { getRepository, Like } from 'typeorm';
import { Message } from '../shared/db/models/Message';
import { SlackChannel } from '../shared/db/models/SlackChannel';
import { SlackUser } from '../shared/db/models/SlackUser';
import type { MessageWithName } from '../shared/models/message/message-with-name';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';
import type { MessageSearchParams } from './search.model';
import { DEFAULT_LIMIT, MIN_LIMIT, MAX_LIMIT } from './search.const';

export class SearchPersistenceService {
  private logger = logger.child({ module: 'SearchPersistenceService' });

  async getSearchFilters(teamId: string): Promise<{ users: string[]; channels: string[] }> {
    const [users, channels] = await Promise.all([
      getRepository(SlackUser)
        .find({ where: { teamId }, select: ['name'], order: { name: 'ASC' } })
        .then((rows) => Array.from(new Set(rows.map((row) => row.name).filter(Boolean)))),
      getRepository(SlackChannel)
        .find({ where: { teamId, channelId: Like('C%') }, select: ['name'], order: { name: 'ASC' } })
        .then((rows) => Array.from(new Set(rows.map((row) => row.name).filter(Boolean)))),
    ]).catch((e: unknown) => {
      logError(this.logger, 'Failed to get search filters', e, { teamId });
      throw e;
    });

    return { users, channels };
  }

  private static resolveLimit(limit: number | undefined): number {
    return limit === undefined || !Number.isFinite(limit) || limit < MIN_LIMIT
      ? DEFAULT_LIMIT
      : Math.min(limit, MAX_LIMIT);
  }

  async searchMessages(params: MessageSearchParams): Promise<MessageWithName[]> {
    const { userName, channel, content, teamId } = params;
    const effectiveLimit = SearchPersistenceService.resolveLimit(params.limit);

    // Each condition is joined with AND in the WHERE clause; queryParams holds the
    // positional `?` values in the same order as the conditions that use them.
    const conditions: string[] = [
      "message.message != ''",
      'message.teamId = ?',
      'slack_user.teamId = ?',
      "message.channel LIKE 'C%'",
    ];
    const queryParams: (string | number)[] = [teamId, teamId];

    if (userName) {
      conditions.push('slack_user.name LIKE ?');
      queryParams.push(`%${userName}%`);
    }

    if (channel) {
      conditions.push('(message.channel LIKE ? OR slack_channel.name LIKE ?)');
      queryParams.push(`%${channel}%`);
      queryParams.push(`%${channel}%`);
    }

    if (content) {
      conditions.push('message.message LIKE ?');
      queryParams.push(`%${content}%`);
    }

    const whereClause = conditions.join(' AND ');

    const query = `
      SELECT message.*, slack_user.name, slack_user.slackId, COALESCE(slack_channel.name, message.channel) AS channelName
      FROM message
      INNER JOIN slack_user ON slack_user.id = message.userIdId
      LEFT JOIN slack_channel ON slack_channel.channelId = message.channel AND slack_channel.teamId = message.teamId
      WHERE ${whereClause}
      ORDER BY message.createdAt DESC
      LIMIT ?
    `;

    queryParams.push(effectiveLimit);

    return getRepository(Message)
      .query(query, queryParams)
      .catch((e: unknown) => {
        logError(this.logger, 'Failed to search messages', e, {
          teamId: params.teamId,
          userName: params.userName,
          channel: params.channel,
          content: params.content,
          limit: params.limit,
        });
        throw e;
      });
  }
}
