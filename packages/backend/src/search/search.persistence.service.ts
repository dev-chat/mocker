import { getRepository, Like, In } from 'typeorm';
import { Message } from '../shared/db/models/Message';
import { SlackChannel } from '../shared/db/models/SlackChannel';
import { SlackUser } from '../shared/db/models/SlackUser';
import type { MessageWithName } from '../shared/models/message/message-with-name';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';
import type { MessageSearchParams, SearchMessagesResponse } from './search.model';
import { DEFAULT_LIMIT, MIN_LIMIT, MAX_LIMIT } from './search.const';

const USER_MENTION_REGEX = /<@([A-Z0-9]+)(?:\|[^>]*)?>/g;
const CHANNEL_MENTION_REGEX = /<#([A-Z0-9]+)(?:\|[^>]*)?>/g;

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

  async searchMessages(params: MessageSearchParams): Promise<SearchMessagesResponse> {
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

    const messages: MessageWithName[] = await getRepository(Message)
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

    const mentions = await this.resolveMentions(messages, teamId);
    return { messages, mentions };
  }

  private async resolveMentions(messages: MessageWithName[], teamId: string): Promise<Record<string, string>> {
    const userIds = new Set<string>();
    const channelIds = new Set<string>();

    for (const msg of messages) {
      USER_MENTION_REGEX.lastIndex = 0;
      CHANNEL_MENTION_REGEX.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = USER_MENTION_REGEX.exec(msg.message)) !== null) {
        userIds.add(match[1]);
      }
      while ((match = CHANNEL_MENTION_REGEX.exec(msg.message)) !== null) {
        channelIds.add(match[1]);
      }
    }

    const mentions: Record<string, string> = {};

    const lookups: Promise<void>[] = [];

    if (userIds.size > 0) {
      lookups.push(
        getRepository(SlackUser)
          .find({ where: { slackId: In([...userIds]), teamId }, select: ['slackId', 'name'] })
          .then((rows) => {
            for (const row of rows) {
              mentions[row.slackId] = row.name;
            }
          }),
      );
    }

    if (channelIds.size > 0) {
      lookups.push(
        getRepository(SlackChannel)
          .find({ where: { channelId: In([...channelIds]), teamId }, select: ['channelId', 'name'] })
          .then((rows) => {
            for (const row of rows) {
              mentions[row.channelId] = row.name;
            }
          }),
      );
    }

    await Promise.all(lookups);

    return mentions;
  }
}
