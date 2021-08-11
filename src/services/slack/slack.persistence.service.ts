import { getRepository } from 'typeorm';
import { SlackChannel } from '../../shared/db/models/SlackChannel';
import { SlackUser as SlackUserModel } from '../../shared/models/slack/slack-models';
import { SlackUser } from '../../shared/db/models/SlackUser';

export class SlackPersistenceService {
  public static getInstance(): SlackPersistenceService {
    if (!SlackPersistenceService.instance) {
      SlackPersistenceService.instance = new SlackPersistenceService();
    }
    return SlackPersistenceService.instance;
  }

  private static instance: SlackPersistenceService;

  // This sucks because TypeORM sucks. Time to consider removing this ORM.
  async saveChannels(channels: any[]): Promise<void> {
    const dbChannels = channels.map(channel => {
      return {
        channelId: channel.id,
        name: channel.name,
        teamId: channel.shared_team_ids[0],
      };
    });

    try {
      for (const channel of dbChannels) {
        const existingChannel = await getRepository(SlackChannel).findOne({
          channelId: channel.channelId,
          teamId: channel.teamId,
        });
        if (existingChannel) {
          getRepository(SlackChannel).update(existingChannel, channel);
        } else {
          getRepository(SlackChannel).save(channel);
        }
      }
      console.log('Updated channel list');
    } catch (e) {
      console.log('Error on updating channels: ', e);
    }
  }

  // This sucks because TypeORM sucks. Time to consider removing this ORM.
  async saveUsers(users: SlackUserModel[]): Promise<void> {
    console.log(users);
    const dbUsers = users.map(user => {
      return {
        slackId: user.id,
        name: user.profile.display_name || user.name,
        teamId: user.team_id,
        botId: user?.profile?.bot_id,
        isBot: !!user.is_bot,
      };
    });
    try {
      for (const user of dbUsers) {
        const existingUser = await getRepository(SlackUser).findOne({ slackId: user.slackId, teamId: user.teamId });
        if (existingUser) {
          getRepository(SlackUser).update(existingUser, user);
        } else {
          getRepository(SlackUser).save(user);
        }
      }
      console.log('Updated latest users in DB.');
    } catch (e) {
      console.log('Error on updating users: ', e);
    }
  }

  async getUserById(userId: string, teamId: string): Promise<SlackUser | undefined> {
    return getRepository(SlackUser).findOne({ slackId: userId, teamId });
  }

  async getBotByBotId(botId: string, teamId: string): Promise<SlackUser | undefined> {
    return getRepository(SlackUser).findOne({ botId, teamId });
  }

  async getChannelById(channelId: string, teamId: string): Promise<SlackChannel | undefined> {
    return getRepository(SlackChannel).findOne({ channelId, teamId });
  }
}
