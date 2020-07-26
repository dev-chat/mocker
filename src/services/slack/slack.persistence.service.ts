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

  saveChannels(channels: any[]) {
    const dbChannels = channels.map(channel => {
      return {
        channelId: channel.id,
        name: channel.name,
        teamId: channel.shared_team_ids[0],
      };
    });
    return getRepository(SlackChannel)
      .save(dbChannels)
      .catch(e => {
        if (e.code === 'ER_DUP_ENTRY') {
          return;
        } else {
          console.error(e);
        }
      });
  }

  saveUsers(users: SlackUserModel[]) {
    const dbUsers = users.map(user => {
      return {
        slackId: user.id,
        name: user.profile.display_name,
        teamId: user.team_id,
      };
    });
    console.log(dbUsers);
    return getRepository(SlackUser)
      .save(dbUsers)
      .catch(e => {
        if (e.code === 'ER_DUP_ENTRY') {
          return;
        } else {
          console.error(e);
        }
      });
  }
}
