import { getRepository } from 'typeorm';
import { Message } from '../shared/db/models/Message';
import type { MessageWithName } from '../shared/models/message/message-with-name';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';
import type { MessageSearchParams } from './search.model';
import { DEFAULT_LIMIT, MIN_LIMIT, PERSISTENCE_MAX_LIMIT } from './search.const';

export class SearchPersistenceService {
  private logger = logger.child({ module: 'SearchPersistenceService' });

  private static resolveLimit(limit: number | undefined): number {
    if (limit === undefined || !Number.isFinite(limit) || limit < MIN_LIMIT) {
      return DEFAULT_LIMIT;
    }
    return Math.min(limit, PERSISTENCE_MAX_LIMIT);
  }

  async searchMessages(params: MessageSearchParams): Promise<MessageWithName[]> {
    const { userName, channel, content } = params;
    const effectiveLimit = SearchPersistenceService.resolveLimit(params.limit);

    // Each condition is joined with AND in the WHERE clause; queryParams holds the
    // positional `?` values in the same order as the conditions that use them.
    const conditions: string[] = ["message.message != ''"];
    const queryParams: (string | number)[] = [];

    if (userName) {
      conditions.push('slack_user.name LIKE ?');
      queryParams.push(`%${userName}%`);
    }

    if (channel) {
      conditions.push('message.channel LIKE ?');
      queryParams.push(`%${channel}%`);
    }

    if (content) {
      conditions.push('message.message LIKE ?');
      queryParams.push(`%${content}%`);
    }

    const whereClause = conditions.join(' AND ');

    const query = `
      SELECT message.*, slack_user.name, slack_user.slackId
      FROM message
      INNER JOIN slack_user ON slack_user.id = message.userIdId
      WHERE ${whereClause}
      ORDER BY message.createdAt DESC
      LIMIT ?
    `;

    queryParams.push(effectiveLimit);

    return getRepository(Message)
      .query(query, queryParams)
      .catch((e: unknown) => {
        logError(this.logger, 'Failed to search messages', e, {
          userName: params.userName,
          channel: params.channel,
          content: params.content,
          limit: params.limit,
        });
        throw e;
      });
  }
}
