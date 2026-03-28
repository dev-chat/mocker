import { getRepository } from 'typeorm';
import { SlackChannel } from '../../../shared/db/models/SlackChannel';
import type { SlackUser as SlackUserModel } from '../../../shared/models/slack/slack-models';
import { SlackUser as SlackUserFromDB } from '../../../shared/db/models/SlackUser';
import { RedisPersistenceService } from '../../../shared/services/redis.persistence.service';
import type { ConversationsListResponse } from '@slack/web-api';
import { logError } from '../../logger/error-logging';
import { logger } from '../../logger/logger';

type SlackUserForStorage = Pick<SlackUserModel, 'id' | 'name'> &
  Partial<Pick<SlackUserModel, 'team_id' | 'is_bot' | 'profile'>>;

const isSlackUserFromDb = (value: unknown): value is SlackUserFromDB => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return typeof Reflect.get(value, 'slackId') === 'string';
};

export class SlackPersistenceService {
  private redis: RedisPersistenceService = RedisPersistenceService.getInstance();
  logger = logger.child({ module: 'SlackPersistenceService' });

  // This sucks because TypeORM sucks. Time to consider removing this ORM.
  async saveChannels(channels?: ConversationsListResponse['channels']): Promise<void> {
    if (!channels) {
      return;
    } else {
      const dbChannels = channels
        .filter((channel) => typeof channel.id === 'string' && channel.id.startsWith('C'))
        .map((channel) => {
          return {
            channelId: channel.id,
            name: channel.name,
            teamId: channel.shared_team_ids?.[0],
          };
        });

      try {
        for (const channel of dbChannels) {
          const existingChannel = await getRepository(SlackChannel).findOne({
            where: {
              channelId: channel.channelId,
              teamId: channel.teamId,
            },
          });
          if (existingChannel) {
            void getRepository(SlackChannel).update(existingChannel, channel);
          } else {
            void getRepository(SlackChannel).save(channel);
          }
        }
        this.logger.info('Updated channel list');
      } catch (e) {
        logError(this.logger, 'Error updating channels', e, {
          channelCount: dbChannels.length,
        });
      }
    }
  }

  getCachedUsers(): Promise<SlackUserFromDB[] | null> {
    return this.redis.getValue(this.getRedisKeyName()).then((users: string | null) => {
      if (!users) {
        return null;
      }

      const parsed: unknown = JSON.parse(users);
      return Array.isArray(parsed) ? parsed.filter(isSlackUserFromDb) : null;
    });
  }

  // This sucks because TypeORM sucks. Time to consider removing this ORM.
  async saveUsers(users: SlackUserForStorage[]): Promise<SlackUserFromDB[]> {
    const dbUsers: SlackUserFromDB[] = users.map((user) => {
      const dbUser = new SlackUserFromDB();
      dbUser.slackId = user.id;
      dbUser.name = user.profile?.display_name || user.name;
      dbUser.teamId = user.team_id || '';
      dbUser.botId = user.profile?.bot_id || '';
      dbUser.isBot = !!user.is_bot;

      return dbUser;
    });

    try {
      await this.redis.setValueWithExpire(this.getRedisKeyName(), JSON.stringify(dbUsers), 'PX', 60000);
      for (const user of dbUsers) {
        const existingUser = await getRepository(SlackUserFromDB).findOne({
          where: {
            slackId: user.slackId,
            teamId: user.teamId,
          },
        });
        if (existingUser) {
          await getRepository(SlackUserFromDB)
            .save({ ...existingUser, user })
            .catch((e) => {
              logError(this.logger, 'Error updating user', e, {
                slackId: user.slackId,
                teamId: user.teamId,
              });
            });
        } else {
          await getRepository(SlackUserFromDB)
            .save({ ...user, activity: [], messages: [] })
            .catch((e) => {
              logError(this.logger, 'Error saving user', e, {
                slackId: user.slackId,
                teamId: user.teamId,
              });
            });
        }
      }
      this.logger.info('Updated latest users in DB.');
      return dbUsers;
    } catch (e) {
      logError(this.logger, 'Error updating users', e, {
        userCount: dbUsers.length,
      });
      throw e;
    }
  }

  async getUserById(userId: string, teamId: string): Promise<SlackUserFromDB | null> {
    return getRepository(SlackUserFromDB).findOne({ where: { slackId: userId, teamId } });
  }

  async getUserByUserName(username: string, teamId: string): Promise<SlackUserFromDB | null> {
    return getRepository(SlackUserFromDB).findOne({ where: { name: username, teamId } });
  }

  async getBotByBotId(botId: string, teamId: string): Promise<SlackUserFromDB | null> {
    return getRepository(SlackUserFromDB).findOne({ where: { botId, teamId } });
  }

  async getChannelById(channelId: string, teamId: string): Promise<SlackChannel | null> {
    return getRepository(SlackChannel).findOne({ where: { channelId, teamId } });
  }

  async getCustomPrompt(slackId: string, teamId: string): Promise<string | null> {
    return getRepository(SlackUserFromDB)
      .findOne({ where: { slackId, teamId } })
      .then((user) => user?.customPrompt ?? null)
      .catch((e) => {
        logError(this.logger, 'Error fetching custom prompt for user', e, { slackId, teamId });
        return null;
      });
  }

  async setCustomPrompt(slackId: string, teamId: string, prompt: string): Promise<boolean> {
    const trimmedPrompt = prompt.trim();
    const normalizedPrompt = trimmedPrompt.length > 0 ? trimmedPrompt : null;

    return getRepository(SlackUserFromDB)
      .update({ slackId, teamId }, { customPrompt: normalizedPrompt })
      .then((result) => {
        if ((result.affected ?? 0) === 0) {
          this.logger.warn(`Cannot set custom prompt: user ${slackId} not found in team ${teamId}`);
          return false;
        }
        return true;
      })
      .catch((e) => {
        logError(this.logger, 'Error setting custom prompt for user', e, { slackId, teamId });
        return false;
      });
  }

  async clearCustomPrompt(slackId: string, teamId: string): Promise<boolean> {
    return getRepository(SlackUserFromDB)
      .update({ slackId, teamId }, { customPrompt: null })
      .then((result) => {
        if ((result.affected ?? 0) === 0) {
          this.logger.warn(`Cannot clear custom prompt: user ${slackId} not found in team ${teamId}`);
          return false;
        }
        return true;
      })
      .catch((e) => {
        logError(this.logger, 'Error clearing custom prompt for user', e, { slackId, teamId });
        return false;
      });
  }

  // This should really require a teamId to be more generic but idc.
  private getRedisKeyName() {
    return `team`;
  }
}
