import { getRepository } from 'typeorm';
import { Activity } from '../../shared/db/models/Activity';
import { SlackUser } from '../../shared/db/models/SlackUser';
import { EventRequest } from '../../shared/models/slack/slack-models';

// Get the current day of the week and UTC time.
// Gets the average number of events for the specified time frame, channel and day of the week.
const query = `SELECT AVG(x.count) as avg from (SELECT DATE_FORMAT(createdAt, "%w") as day, DATE_FORMAT(FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP (createdAt)/300)*300), "%k:%i") as time, DATE_FORMAT(createdAt, "%Y-%c-%e") as date, COUNT(*) as count, channel from activity GROUP BY day,time,date, channel) as x WHERE x.day="1" AND x.time="14:45" AND x.channel="C2ZVBM51V";`;
export class ActivityPersistenceService {
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

  async getHottestChannels() {
    // Get top 10 most popular channels by daily average.
    const query = `SELECT AVG(x.count) as avg, x.channel as channel from (SELECT DATE_FORMAT(createdAt, "%Y-%c-%e") AS date, COUNT(*) AS count, channel  FROM activity GROUP BY date,channel) as x group by x.channel ORDER BY avg DESC LIMIT 0, 10;`;
    // Get most recent 5 minute block.
    const date = new Date();
    const hour = date.getUTCHours();
    let minute: string | number = date.getUTCMinutes();
    // Pads minute with a 0.
    if (minute < 10) {
      minute = '0' + minute;
    }
    const time = `${hour}:${minute}`;

    const utcDate = `${date.getUTCDay()}-${date.getUTCMonth() + 1}-${date.getUTCFullYear()}`;

    // Final most recent 5 min block.
    const mostRecentFiveMinBlock = {
      time,
      date: utcDate,
    };
    // Compare to average for that five minute block.
    // If greater than average, is hot
    // If less than or equal to average but greater than half of average, is lukewarm
    // If less than half of average, is cold.
  }
}
