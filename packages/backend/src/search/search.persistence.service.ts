import { getRepository } from 'typeorm';
import { Message } from '../shared/db/models/Message';
import type { MessageWithName } from '../shared/models/message/message-with-name';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';

export interface MessageSearchParams {
  userName?: string;
  channel?: string;
  content?: string;
  limit?: number;
}

export class SearchPersistenceService {
  private logger = logger.child({ module: 'SearchPersistenceService' });

  async searchMessages(params: MessageSearchParams): Promise<MessageWithName[]> {
    const { userName, channel, content, limit = 100 } = params;

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

    queryParams.push(limit);

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
