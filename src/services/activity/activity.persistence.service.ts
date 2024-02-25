import { DataSource } from 'typeorm';
import { Activity } from '../../shared/db/models/Activity';
import { SlackUser } from '../../shared/db/models/SlackUser';
import { EventRequest } from '../../shared/models/slack/slack-models';
import { DBClient } from '../../shared/db/DBClient';

export class ActivityPersistenceService {
  ds: DataSource = DBClient;

  isValidRequest(request: EventRequest) {
    return (
      !!request.event.user &&
      typeof request.event.user === 'string' &&
      request.event.type !== 'user_profile_changed' &&
      (!!request.event.channel || !!request.event.item?.channel) &&
      !!request.event.channel_type &&
      !!request.team_id &&
      !!request.event.type
    );
  }

  async logActivity(request: EventRequest) {
    if (!this.isValidRequest(request)) {
      return;
    }

    const user: SlackUser | null = await this.ds.getRepository(SlackUser).findOne({
      where: {
        slackId: request?.event?.user,
        teamId: request?.team_id,
      },
    });

    const activity = new Activity();
    activity.channel = request.event.channel || request.event.item.channel;
    activity.channelType = request.event.channel_type;
    activity.teamId = request.team_id;
    activity.userId = user as SlackUser;
    activity.eventType = request.event.type;
    return this.ds.getRepository(Activity).save(activity);
  }
}
