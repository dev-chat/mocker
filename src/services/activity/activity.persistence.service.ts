import { DataSource, getRepository } from 'typeorm';
import { Activity } from '../../shared/db/models/Activity';
import { SlackUser } from '../../shared/db/models/SlackUser';
import { EventRequest } from '../../shared/models/slack/slack-models';
import { WebService } from '../web/web.service';
import { DBClient } from '../../shared/db/DBClient';

export class ActivityPersistenceService {
  web: WebService = WebService.getInstance();
  ds: DataSource = DBClient;

  async logActivity(request: EventRequest) {
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
    const activity = new Activity();
    activity.channel = request.event.channel || request.event.item.channel;
    activity.channelType = request.event.channel_type;
    activity.teamId = request.team_id;
    activity.userId = user as SlackUser;
    activity.eventType = request.event.type;
    return this.ds.createQueryBuilder().insert().into(Activity).values(activity).execute();
  }
}
