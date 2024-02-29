import { KnownBlock } from '@slack/web-api';
import { getRepository } from 'typeorm';
import { Activity } from '../../shared/db/models/Activity';
import { SlackUser } from '../../shared/db/models/SlackUser';
import { EventRequest, SlashCommandRequest } from '../../shared/models/slack/slack-models';
import { WebService } from '../web/web.service';
import { Temperature, TimeBlock } from './activity.model';
import { AIService } from '../ai/ai.service';
import { MessageWithName } from '../../shared/models/message/message-with-name';
import { HistoryPersistenceService } from '../history/history.persistence.service';

interface ChannelImage {
  channel: string;
  imageUrl?: string;
  prompt?: string;
}

export class ActivityPersistenceService {
  private web: WebService = WebService.getInstance();
  private aiService: AIService = new AIService();
  private historyPersistenceService = new HistoryPersistenceService();
  private refreshTime = true;

  public static getInstance(): ActivityPersistenceService {
    if (!ActivityPersistenceService.instance) {
      ActivityPersistenceService.instance = new ActivityPersistenceService();
    }
    return ActivityPersistenceService.instance;
  }

  private static instance: ActivityPersistenceService;

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
    getRepository(Activity).insert(activity);
  }

  async updateLatestHotness() {
    console.log('updating latest hotness');
    // This should be in redis not here.
    if (this.refreshTime) {
      console.log('refreshing latest hotness');
      this.refreshTime = false;
      // Every ffteen minutes.
      setTimeout(() => (this.refreshTime = true), 300000);
      const hottest: Temperature[] = await this.getHottestChannels();
      console.log(hottest);
      const images: Promise<ChannelImage>[] = [];
      if (hottest.length > 0) {
        for (let i = 0; i < hottest.length; i++) {
          // Hardcoded team id BOO.
          const request = { team_id: `T2ZV0GCNS`, channel_id: hottest[i].channel };
          const history: MessageWithName[] = await this.historyPersistenceService.getHistory(
            request as SlashCommandRequest,
            false,
          );
          const formattedHistory: string = this.aiService.formatHistory(history);
          images.push(
            (async () => {
              const prompt = await this.aiService
                .promptWithHistory(
                  'hottest',
                  '',
                  formattedHistory,
                  'generate a prompt that can be used to generate an image that would be an ad for products related to the conversation',
                )
                .catch((e) => {
                  console.error(e);
                });

              if (prompt) {
                const imageUrl = await this.aiService
                  .generateImage('hotness', 'T2ZV0GCNS', `\`${prompt}\`` as string)
                  .catch((e) => {
                    console.error(e);
                  });
                return { channel: hottest[i].channel, imageUrl, prompt } as ChannelImage;
              } else {
                return { channel: hottest[i].channel } as ChannelImage;
              }
            })(),
          );
        }

        Promise.all(images).then((channelImages) => {
          console.log(channelImages);
          channelImages.forEach((channelImage) => {
            if (channelImage.imageUrl) {
              const blocks: KnownBlock[] = [
                {
                  type: 'image',
                  image_url: channelImage.imageUrl,
                  alt_text: '',
                },
                {
                  type: 'context',
                  elements: [
                    {
                      type: 'mrkdwn',
                      text: `:robot_face: _A hyper-targeted advertisement, just for you._ :robot_face:`,
                    },
                  ],
                },
              ];

              this.web.sendMessage(channelImage.channel, '', blocks).catch((e) => {
                console.error(e);
                return '';
              });
            }
          });
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
