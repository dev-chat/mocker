import { WebAPICallResult } from '@slack/web-api';
import { getRepository } from 'typeorm';
import { Activity } from '../../shared/db/models/Activity';
import { SlackUser } from '../../shared/db/models/SlackUser';
import { EventRequest } from '../../shared/models/slack/slack-models';
import { WebService } from '../web/web.service';
import { Temperature, TimeBlock } from './activity.model';

export class ActivityPersistenceService {
  private web: WebService = WebService.getInstance();
  private refreshTime = true;

  public static getInstance(): ActivityPersistenceService {
    if (!ActivityPersistenceService.instance) {
      ActivityPersistenceService.instance = new ActivityPersistenceService();
    }
    return ActivityPersistenceService.instance;
  }

  private static instance: ActivityPersistenceService;

  async logActivity(request: EventRequest) {
    console.log(request.event.user);
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

  async updateLatestHotness() {
    // This should be in redis not here.
    if (this.refreshTime) {
      this.refreshTime = false;
      setTimeout(() => (this.refreshTime = true), 120000);
      const hottest: Temperature[] = await this.getHottestChannels();
      if (hottest.length > 0) {
        let text = ``;
        for (let i = 0; i < hottest.length; i++) {
          text += `\n<#${hottest[i].channel}> : ${this.getEmoji(hottest.length - i)}`;
        }
        const timestamp = Math.floor(new Date().getTime() / 1000);
        const blocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `<!date^${timestamp}^Posted {date_num} {time_secs}|Posted at some point today>`,
                verbatim: false,
              },
            ],
          },
        ];

        await this.web
          .sendMessage('#hot', text, blocks)
          .then((result: WebAPICallResult) => result.ts as string)
          .catch(e => {
            console.error(e);
            return '';
          });
      }
    }
  }

  getEmoji(numberOfEmojis: number) {
    const fire = ':fire:';
    let text = '';
    for (let i = 0; i < numberOfEmojis; i++) {
      text += fire;
    }
    return text;
  }

  async getHottestChannels(): Promise<Temperature[]> {
    console.time('getHottestChannels');
    const timeblock = this.getMostRecentTimeblock();
    const hottestChannelsFromDb = await this.getHottestChannelsFromDB(timeblock);
    console.timeEnd('getHottestChannels');
    return hottestChannelsFromDb;
  }

  getHottestChannelsFromDB(time: TimeBlock) {
    const query = `SELECT a.count, a.channel
    FROM (
    SELECT x.count as count, x.channel as channel 
      FROM (
        SELECT DATE_FORMAT(createdAt, "%w") as day, 
        DATE_FORMAT(FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP (createdAt)/120)*120), "%k:%i") as time, 
        DATE_FORMAT(createdAt, "%Y-%c-%e") as date,
        COUNT(*) as count,
        channel
        FROM activity
        WHERE eventType="message"
        GROUP BY day,time,date, channel
        ) as x 
        WHERE x.time="${time.time}" AND x.date="${time?.date?.year}-${time?.date?.month}-${time?.date?.dayOfMonth}"
      ) as a
        CROSS JOIN
        (
        SELECT z.avg as avg, z.channel as channel
        FROM
        (
          SELECT AVG(y.count) as avg, y.channel as channel
          FROM (
            SELECT DATE_FORMAT(createdAt, "%w") as day,
            DATE_FORMAT(FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP (createdAt)/120)*120), "%k:%i") as time,
            DATE_FORMAT(createdAt, "%Y-%c-%e") as date,
            COUNT(*) as count,
            channel
            FROM activity
            WHERE eventType="message"
            GROUP BY day,time,date, channel
            ) as y
          WHERE y.day="${time?.date?.dayOfWeek}" AND y.time="${time?.time}" AND y.date!="${time?.date?.year}-${time?.date?.month}-${time?.date?.dayOfMonth}"
          GROUP BY channel
        ) as z
        ) as b
        WHERE a.count > b.avg GROUP BY a.channel, a.count;
  `;
    return getRepository(Activity).query(query);
  }

  getMostRecentTimeblock(): TimeBlock {
    const date = new Date();
    const hour = date.getUTCHours();
    let minute: string | number = Math.floor(date.getUTCMinutes() / 2) * 2;
    // Pads minute with a 0.
    if (minute < 10) {
      minute = '0' + minute;
    }
    const time = `${hour}:${minute}`;

    return {
      time,
      date: {
        dayOfWeek: date.getUTCDay(),
        dayOfMonth: date.getUTCDate(),
        month: date.getUTCMonth() + 1,
        year: date.getUTCFullYear(),
      },
    };
  }
}
