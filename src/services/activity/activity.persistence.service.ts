import { getRepository } from 'typeorm';
import { Activity } from '../../shared/db/models/Activity';
import { EventRequest } from '../../shared/models/slack/slack-models';

export class ActivityPersistenceService {
  public static getInstance(): ActivityPersistenceService {
    if (!ActivityPersistenceService.instance) {
      ActivityPersistenceService.instance = new ActivityPersistenceService();
    }
    return ActivityPersistenceService.instance;
  }

  private static instance: ActivityPersistenceService;

  logActivity(request: EventRequest) {
    const activity = new Activity();
    activity.channel = request.event.channel;
    activity.channelType = request.event.channel_type;
    activity.teamId = request.team_id;
    activity.userId = request.event.user;
    activity.eventType = request.event.type;
    getRepository(Activity).insert(activity);
  }
}
