import { InsertResult, getRepository } from 'typeorm';
import { SlackUser } from '../../shared/db/models/SlackUser';
import { EventRequest, SlashCommandRequest } from '../../shared/models/slack/slack-models';
import { Message } from '../../shared/db/models/Message';
import { MessageWithName } from '../../shared/models/message/message-with-name';

export class HistoryPersistenceService {
  public static getInstance(): HistoryPersistenceService {
    if (!HistoryPersistenceService.instance) {
      HistoryPersistenceService.instance = new HistoryPersistenceService();
    }
    return HistoryPersistenceService.instance;
  }

  private static instance: HistoryPersistenceService;

  async logHistory(request: EventRequest): Promise<InsertResult | undefined> {
    // This is a bandaid to stop workflows from breaking the service.
    if (typeof request.event.user !== 'string' || request.event.type === 'user_profile_changed') {
      return;
    }

    const user: SlackUser | undefined = await getRepository(SlackUser).findOne({
      slackId: request?.event?.user,
      teamId: request?.team_id,
    });
    const message = new Message();
    message.channel = request.event.channel || request.event.item.channel;
    message.teamId = request.team_id;
    message.userId = user as SlackUser;
    message.message = request.event.text;
    return getRepository(Message).insert(message);
  }

  async getHistory(request: SlashCommandRequest): Promise<MessageWithName[]> {
    const teamId = request.team_id;
    const channel = request.channel_id;
    const query = `
    select message.*, slack_user.name, message.createdAt from message INNER JOIN slack_user ON slack_user.id=message.userIdId WHERE message.createdAt >= NOW() - INTERVAL 30 MINUTE AND message.teamId=? AND message.channel=? AND message.userIdId != 39 ORDER BY createdAt ASC;`;

    return getRepository(Message).query(query, [teamId, channel]);
  }
}
