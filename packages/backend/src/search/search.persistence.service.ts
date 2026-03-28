import { getRepository, Like } from 'typeorm';
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
    const effectiveOffset =
      params.offset !== undefined && Number.isFinite(params.offset) && params.offset >= 0
        ? Math.floor(params.offset)
        : 0;

    // Each condition is joined with AND in the WHERE clause; filterParams holds the
    // positional `?` values in the same order as the conditions that use them.
    const conditions: string[] = [
      "message.message != ''",
      'message.teamId = ?',
      'slack_user.teamId = ?',
      "message.channel LIKE 'C%'",
    ];
    const filterParams: (string | number)[] = [teamId, teamId];

    if (userName) {
      conditions.push('slack_user.name LIKE ?');
      filterParams.push(`%${userName}%`);
    }

    if (channel) {
      conditions.push('(message.channel LIKE ? OR slack_channel.name LIKE ?)');
      filterParams.push(`%${channel}%`);
      filterParams.push(`%${channel}%`);
    }

    if (content) {
      conditions.push('message.message LIKE ?');
      filterParams.push(`%${content}%`);
    }

    const whereClause = conditions.join(' AND ');

    const joins = `
      FROM message
      INNER JOIN slack_user ON slack_user.id = message.userIdId
      LEFT JOIN slack_channel ON slack_channel.channelId = message.channel AND slack_channel.teamId = message.teamId
      WHERE ${whereClause}
    `;

    const countQuery = `SELECT COUNT(*) AS total ${joins}`;

    const dataQuery = `
      SELECT message.*, slack_user.name, slack_user.slackId, COALESCE(slack_channel.name, message.channel) AS channelName
      ${joins}
      ORDER BY message.createdAt DESC
      LIMIT ?
      OFFSET ?
    `;

    const repo = getRepository(Message);

    const countRows: { total: number | string }[] = await repo.query(countQuery, filterParams).catch((e: unknown) => {
      logError(this.logger, 'Failed to search messages', e, {
        teamId: params.teamId,
        userName: params.userName,
        channel: params.channel,
        content: params.content,
        limit: params.limit,
        offset: params.offset,
      });
      throw e;
    });

    const total = Number(countRows[0]?.total ?? 0);

    const messages: MessageWithName[] = await repo
      .query(dataQuery, [...filterParams, effectiveLimit, effectiveOffset])
      .catch((e: unknown) => {
        logError(this.logger, 'Failed to search messages', e, {
          teamId: params.teamId,
          userName: params.userName,
          channel: params.channel,
          content: params.content,
          limit: params.limit,
          offset: params.offset,
        });
        throw e;
      });

    const mentions = await this.resolveMentions(messages, teamId);
    return { messages, mentions, total };
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

    if (userIds.size === 0 && channelIds.size === 0) {
      return {};
    }

    const userPlaceholders = userIds.size > 0 ? [...userIds].map(() => '?').join(', ') : null;
    const channelPlaceholders = channelIds.size > 0 ? [...channelIds].map(() => '?').join(', ') : null;

    const parts: string[] = [];
    const queryParams: string[] = [];

    if (userPlaceholders) {
      parts.push(`SELECT slackId AS id, name FROM slack_user WHERE teamId = ? AND slackId IN (${userPlaceholders})`);
      queryParams.push(teamId, ...[...userIds]);
    }

    if (channelPlaceholders) {
      parts.push(
        `SELECT channelId AS id, name FROM slack_channel WHERE teamId = ? AND channelId IN (${channelPlaceholders})`,
      );
      queryParams.push(teamId, ...[...channelIds]);
    }

    const rows: { id: string; name: string }[] = await getRepository(Message).query(
      parts.join(' UNION ALL '),
      queryParams,
    );

    const mentions: Record<string, string> = {};
    for (const row of rows) {
      mentions[row.id] = row.name;
    }
    return mentions;
  }
}
