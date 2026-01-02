import { InsertResult, getRepository } from 'typeorm';
import { SlackUser } from '../db/models/SlackUser';
import { EventRequest, SlashCommandRequest } from '../models/slack/slack-models';
import { Message } from '../db/models/Message';
import { MessageWithName } from '../models/message/message-with-name';

export interface HistoryOptions {
  teamId: string;
  channelId: string;
  maxMessages?: number;
  timeWindowMinutes?: number;
  excludeUserId?: number;
}

export class HistoryPersistenceService {
  async logHistory(request: EventRequest): Promise<InsertResult | undefined> {
    // This is a bandaid to stop workflows from breaking the service.
    if (typeof request.event.user !== 'string' || request.event.type === 'user_profile_changed') {
      return;
    }

    const user: SlackUser | null = await getRepository(SlackUser).findOne({
      where: {
        slackId: request?.event?.user,
        teamId: request?.team_id,
      },
    });
    const message = new Message();
    message.channel = request.event.channel || request.event.item.channel;
    message.teamId = request.team_id;
    message.userId = user as SlackUser;
    message.message = request.event.text;
    return getRepository(Message).insert(message);
  }

  async getLastFiveMinutesCount(teamId: string, channelId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM message 
      WHERE teamId=? AND channel=? AND createdAt >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
    `;
    const result = await getRepository(Message).query(query, [teamId, channelId]);
    return result[0].count;
  }

  async getHistory(request: SlashCommandRequest, isDaily: boolean): Promise<MessageWithName[]> {
    const teamId = request.team_id;
    const channel = request.channel_id;
    const interval = isDaily ? 'INTERVAL 1 DAY' : 'INTERVAL 1 HOUR';
    const query = `
    (
    SELECT message.*, slack_user.name
    FROM message
    INNER JOIN slack_user ON slack_user.id=message.userIdId
    WHERE message.userIdId != 39 AND message.teamId=? AND message.channel=? AND message.message != ''
    ORDER BY message.createdAt DESC
    LIMIT 100
  )
  UNION
  (
    SELECT message.*, slack_user.name
    FROM message
    INNER JOIN slack_user ON slack_user.id=message.userIdId
    WHERE message.userIdId != 39 AND message.teamId=? AND message.channel=? AND message.message != '' AND createdAt >= DATE_SUB(NOW(), ${interval})
    ORDER BY createdAt DESC
  ) ORDER BY createdAt ASC;`;

    return getRepository(Message).query(query, [teamId, channel, teamId, channel]);
  }

  /**
   * Get history with configurable options.
   * Unlike getHistory(), this method does NOT exclude any users by default,
   * allowing Moonbeam to see its own prior messages for conversational continuity.
   */
  async getHistoryWithOptions(options: HistoryOptions): Promise<MessageWithName[]> {
    const { teamId, channelId, maxMessages = 200, timeWindowMinutes = 120, excludeUserId } = options;

    const userFilter = excludeUserId !== undefined ? `AND message.userIdId != ${excludeUserId}` : '';

    const query = `
    (
      SELECT message.*, slack_user.name
      FROM message
      INNER JOIN slack_user ON slack_user.id=message.userIdId
      WHERE message.teamId=? AND message.channel=? AND message.message != '' ${userFilter}
      ORDER BY message.createdAt DESC
      LIMIT ?
    )
    UNION
    (
      SELECT message.*, slack_user.name
      FROM message
      INNER JOIN slack_user ON slack_user.id=message.userIdId
      WHERE message.teamId=? AND message.channel=? AND message.message != '' ${userFilter}
        AND createdAt >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
      ORDER BY createdAt DESC
    ) ORDER BY createdAt ASC;`;

    return getRepository(Message).query(query, [teamId, channelId, maxMessages, teamId, channelId, timeWindowMinutes]);
  }
}
