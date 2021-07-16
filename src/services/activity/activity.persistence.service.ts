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
        for (const chan of hottest) {
          text += `<#${chan.id}> : ${this.getEmoji(chan.temperature)}\n`;
        }
        this.web.sendMessage('#hot', text);
      }
    }
  }

  getEmoji(temp: string) {
    if (temp === 'hot') {
      return ':fire:';
    } else if (temp === 'average') {
      return ':neutral_face:';
    } else {
      return ':snowflake:';
    }
  }

  async getHottestChannels() {
    console.time('getHottestChannels');
    // Get top 10 most popular channels by daily average.
    // const query = `SELECT AVG(x.count) as avg, x.channel as channel from (SELECT DATE_FORMAT(createdAt, "%Y-%c-%e") AS date, COUNT(*) AS count, channel  FROM activity GROUP BY date,channel) as x group by x.channel ORDER BY avg DESC LIMIT 0, 10;`;
    // Get most recent 5 minute block.
    const timeblock = this.getMostRecentTimeblock();
    const channels = await this.web.getAllChannels().then(result => result.channels);
    const hottestChannels: Temperature[] = [];
    console.log(timeblock);
    const currentMessages = await this.getCurrentNumberOfMessages(timeblock);
    const averageMessages = await this.getMostRecentAverageActivity(timeblock);

    for (const channel of channels) {
      if (channel.name !== 'hot') {
        const averageMessage = parseInt(averageMessages?.find((x: any) => x.channel === channel.id)?.avg || 0);
        const currentMessage = parseInt(currentMessages?.find((x: any) => x.channel === channel.id)?.count || 0);
        console.log(`${channel.id} - ${channel.name} - avg: ${averageMessage} - current: ${currentMessage}`);
        const channelTemp = {
          id: channel.id,
          name: channel.name,
          temperature: '',
          average: averageMessage,
          current: currentMessage,
        };

        if (currentMessage > averageMessage) {
          channelTemp.temperature = 'hot';
        } else if (currentMessage < averageMessage / 2) {
          channelTemp.temperature = 'cold';
        } else {
          channelTemp.temperature = 'average';
        }

        hottestChannels.push(channelTemp);
      }
    }
    // Channels that are hot right now and in the top 10 by day.
    const sorted = hottestChannels
      .filter(chan => chan.temperature === 'hot')
      .sort((a: Temperature, b: Temperature) => b.current - a.current);
    console.log('hottest channels');
    console.log(sorted);
    console.timeEnd('getHottestChannels');
    return sorted;
  }

  getCurrentNumberOfMessages(time: TimeBlock) {
    const query = `SELECT x.count as count, x.channel as channel from (SELECT DATE_FORMAT(createdAt, "%w") as day, DATE_FORMAT(FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP (createdAt)/120)*120), "%k:%i") as time, DATE_FORMAT(createdAt, "%Y-%c-%e") as date, COUNT(*) as count, channel from activity WHERE eventType="message" GROUP BY day,time,date, channel) as x WHERE x.time="${time?.time}" AND x.date="${time?.date?.year}-${time?.date?.month}-${time?.date?.dayOfMonth}";`;
    console.log(query);
    return getRepository(Activity)
      .query(query)
      .then(result => {
        console.log('currnet number of messages');
        console.log(result);
        return result;
      });
  }

  getMostRecentAverageActivity(time: TimeBlock) {
    // Some bad sql practices here that need to be cleared up.
    const query = `SELECT AVG(x.count) as avg, x.channel as channel from (SELECT DATE_FORMAT(createdAt, "%w") as day, DATE_FORMAT(FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP (createdAt)/120)*120), "%k:%i") as time, DATE_FORMAT(createdAt, "%Y-%c-%e") as date, COUNT(*) as count, channel from activity WHERE eventType="message" GROUP BY day,time,date, channel) as x WHERE x.day="${time?.date?.dayOfWeek}" AND x.time="${time?.time}" AND x.date!="${time?.date?.year}-${time?.date?.month}-${time?.date?.dayOfMonth}" GROUP BY channel;`;
    console.log(query);
    return getRepository(Activity)
      .query(query)
      .then(result => {
        console.log('most recent average activity');
        console.log(result);
        return result;
      });
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

    // Final most recent 5 min block.
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
