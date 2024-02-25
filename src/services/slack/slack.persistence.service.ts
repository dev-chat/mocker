import { DataSource } from 'typeorm';
import { SlackChannel } from '../../shared/db/models/SlackChannel';
import { SlackUser as SlackUserModel } from '../../shared/models/slack/slack-models';
import { SlackUser as SlackUserFromDB } from '../../shared/db/models/SlackUser';
import { RedisPersistenceService } from '../../shared/services/redis.persistence.service';
import { ConversationsListResponse } from '@slack/web-api';

export class SlackPersistenceService {
  redis: RedisPersistenceService;
  ds: DataSource;

  constructor(redis: RedisPersistenceService, ds: DataSource) {
    this.redis = redis;
    this.ds = ds;
  }

  // This sucks because TypeORM sucks. Time to consider removing this ORM.
  async saveChannels(channels?: ConversationsListResponse['channels']): Promise<void> {
    if (!channels) {
      return;
    } else {
      const dbChannels = channels.map((channel) => {
        return {
          channelId: channel.id,
          name: channel.name,
          teamId: channel?.shared_team_ids?.[0],
        };
      });

      try {
        for (const channel of dbChannels) {
          const existingChannel = await this.ds.getRepository(SlackChannel).findOne({
            where: {
              channelId: channel.channelId,
              teamId: channel.teamId,
            },
          });
          if (existingChannel) {
            this.ds.getRepository(SlackChannel).update(existingChannel, channel);
          } else {
            this.ds.getRepository(SlackChannel).save(channel);
          }
        }
        console.log('Updated channel list');
      } catch (e) {
        console.log('Error on updating channels: ', e);
      }
    }
  }

  getCachedUsers(): Promise<SlackUserFromDB[] | null> {
    return this.redis
      .getValue(this.getRedisKeyName())
      .then((users) => (users ? (JSON.parse(users) as SlackUserFromDB[]) : null));
  }

  // This sucks because TypeORM sucks. Time to consider removing this ORM.
  async saveUsers(users: SlackUserModel[]): Promise<SlackUserFromDB[]> {
    const dbUsers: SlackUserFromDB[] = users.map((user) => {
      return {
        slackId: user.id,
        name: user.profile.display_name || user.name,
        teamId: user.team_id,
        botId: user?.profile?.bot_id ? user.profile.bot_id : '',
        isBot: !!user.is_bot,
      } as SlackUserFromDB;
    });

    try {
      await this.redis.setValueWithExpire(this.getRedisKeyName(), JSON.stringify(dbUsers), 'PX', 60000);
      for (const user of dbUsers) {
        const existingUser = await this.ds.getRepository(SlackUserFromDB).findOne({
          where: {
            slackId: user.slackId,
            teamId: user.teamId,
          },
        });
        if (existingUser) {
          this.ds.getRepository(SlackUserFromDB).update(existingUser, user);
        } else {
          this.ds.getRepository(SlackUserFromDB).save(user);
        }
      }
      console.log('Updated latest users in DB.');
      return dbUsers;
    } catch (e) {
      console.log('Error on updating users: ', e);
      throw e;
    }
  }

  async getUserById(userId: string, teamId: string): Promise<SlackUserFromDB | null> {
    return this.ds.getRepository(SlackUserFromDB).findOne({ where: { slackId: userId, teamId } });
  }

  async getUserByUserName(username: string, teamId: string): Promise<SlackUserFromDB | null> {
    return this.ds.getRepository(SlackUserFromDB).findOne({ where: { name: username, teamId } });
  }

  async getBotByBotId(botId: string, teamId: string): Promise<SlackUserFromDB | null> {
    return this.ds.getRepository(SlackUserFromDB).findOne({ where: { botId, teamId } });
  }

  async getChannelById(channelId: string, teamId: string): Promise<SlackChannel | null> {
    return this.ds.getRepository(SlackChannel).findOne({ where: { channelId, teamId } });
  }

  // This should really require a teamId to be more generic but idc.
  private getRedisKeyName() {
    return `team`;
  }
}
