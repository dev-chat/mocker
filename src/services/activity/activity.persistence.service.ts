import { getRepository } from 'typeorm';
import { Activity } from '../../shared/db/models/Activity';
import { SlackUser } from '../../shared/db/models/SlackUser';
import { EventRequest } from '../../shared/models/slack/slack-models';
import { WebService } from '../web/web.service';
import { TimeBlock } from './activity.model';

// Get the current day of the week and UTC time.
// Gets the average number of events for the specified time frame, channel and day of the week.
// const query = `SELECT AVG(x.count) as avg from (SELECT DATE_FORMAT(createdAt, "%w") as day, DATE_FORMAT(FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP (createdAt)/300)*300), "%k:%i") as time, DATE_FORMAT(createdAt, "%Y-%c-%e") as date, COUNT(*) as count, channel from activity GROUP BY day,time,date, channel) as x WHERE x.day="1" AND x.time="14:45" AND x.channel="C2ZVBM51V";`;
export class ActivityPersistenceService {
  private web: WebService = WebService.getInstance();

  public static getInstance(): ActivityPersistenceService {
    if (!ActivityPersistenceService.instance) {
      ActivityPersistenceService.instance = new ActivityPersistenceService();
    }
    return ActivityPersistenceService.instance;
  }

  private static instance: ActivityPersistenceService;

  async logActivity(request: EventRequest) {
    const user: SlackUser | undefined = await getRepository(SlackUser).findOne({
      slackId: request?.event?.user,
      teamId: request?.team_id,
    });
    const activity = new Activity();
    activity.channel = request.event.channel || request.event.item.channel;
    activity.channelType = request.event.channel_type;
    activity.teamId = request.team_id;
    activity.userId = user as SlackUser;
    activity.eventType = request.event.type;
    getRepository(Activity).insert(activity);
  }

  async getHottestChannels(channel: string) {
    // Get top 10 most popular channels by daily average.
    // const query = `SELECT AVG(x.count) as avg, x.channel as channel from (SELECT DATE_FORMAT(createdAt, "%Y-%c-%e") AS date, COUNT(*) AS count, channel  FROM activity GROUP BY date,channel) as x group by x.channel ORDER BY avg DESC LIMIT 0, 10;`;
    // Get most recent 5 minute block.
    const date = new Date();
    const hour = date.getUTCHours();
    let minute: string | number = date.getUTCMinutes();
    // Pads minute with a 0.
    if (minute < 10) {
      minute = '0' + minute;
    }
    const time = `${hour}:${minute}`;

    // Final most recent 5 min block.
    const mostRecentFiveMinBlock: TimeBlock = {
      time,
      date: {
        dayOfWeek: date.getUTCDay(),
        dayOfMonth: date.getUTCDate(),
        month: date.getUTCMonth() + 1,
        year: date.getUTCFullYear(),
      },
    };
    console.log(mostRecentFiveMinBlock);
    const channels = await this.web.getAllChannels();
    const hottestChannels: Record<string, string> = {};

    for (channel of channels) {
      const averageMessages = await this.getMostRecentAverageActivity(mostRecentFiveMinBlock, channel);
      const currentMessages = await this.getCurrentNumberOfMessages(mostRecentFiveMinBlock, channel);
      if (currentMessages > averageMessages) {
        hottestChannels[channel] = 'hot';
      } else if (currentMessages < averageMessages / 2) {
        hottestChannels[channel] = 'cold';
      } else {
        hottestChannels[channel] = 'average';
      }
    }
    console.log(hottestChannels);
    return hottestChannels;
  }

  getCurrentNumberOfMessages(time: TimeBlock, channel: string) {
    const query = `SELECT x.count as count from (SELECT DATE_FORMAT(createdAt, "%w") as day, DATE_FORMAT(FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP (createdAt)/300)*300), "%k:%i") as time, DATE_FORMAT(createdAt, "%Y-%c-%e") as date, COUNT(*) as count, channel from activity GROUP BY day,time,date, channel) as x WHERE x.date="${time?.date?.year}-${time?.date?.month}-${time?.date?.dayOfMonth}" AND x.channel="${channel}";`;
    return getRepository(Activity).query(query);
  }

  // Idk, this might not even be what i want. I am too tired to figure it out.
  getMostRecentAverageActivity(time: TimeBlock, channel: string) {
    // Some bad sql practices here that need to be cleared up.
    const query = `SELECT AVG(x.count) as avg from (SELECT DATE_FORMAT(createdAt, "%w") as day, DATE_FORMAT(FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP (createdAt)/300)*300), "%k:%i") as time, DATE_FORMAT(createdAt, "%Y-%c-%e") as date, COUNT(*) as count, channel from activity GROUP BY day,time,date, channel) as x WHERE x.day="${time?.date?.dayOfWeek}" AND x.time="${time?.time}" AND x.channel="${channel}";`;
    return getRepository(Activity).query(query);
  }
}
