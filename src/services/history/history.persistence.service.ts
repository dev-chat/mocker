import { InsertResult, getRepository } from 'typeorm';
import { SlackUser } from '../../shared/db/models/SlackUser';
import { EventRequest } from '../../shared/models/slack/slack-models';
import { Message } from '../../shared/db/models/Message';

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
}
