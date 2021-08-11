import axios from 'axios';
import { ChannelResponse, SlackUser } from '../../shared/models/slack/slack-models';
import { SlackUser as SlackUserFromDB } from '../../shared/db/models/SlackUser';
import { WebService } from '../web/web.service';
import { USER_ID_REGEX } from './constants';
import { SlackPersistenceService } from './slack.persistence.service';

export class SlackService {
  public static getInstance(): SlackService {
    if (!SlackService.instance) {
      SlackService.instance = new SlackService();
    }
    return SlackService.instance;
  }
  private static instance: SlackService;
  private web: WebService = WebService.getInstance();
  private persistenceService: SlackPersistenceService = SlackPersistenceService.getInstance();

  public sendResponse(responseUrl: string, response: ChannelResponse): void {
    axios
      .post(responseUrl, response)
      .catch((e: Error) => console.error(`Error responding: ${e.message} at ${responseUrl}`));
  }

  /**
   * Retrieves the user id from a string.
   * Expected format is <@U235KLKJ>
   */
  public getUserId(user: string): string {
    if (!user) {
      return '';
    }
    const regArray = user.match(USER_ID_REGEX);
    return regArray ? regArray[0].slice(2) : '';
  }

  /**
   * Returns the user name by id
   */
  public getUserNameById(userId: string, teamId: string): Promise<string | undefined> {
    return this.persistenceService.getUserById(userId, teamId).then(user => user?.name);
  }

  /**
   * Kind of a janky way to get the requesting users ID via callback id.
   */
  public getUserIdByCallbackId(callbackId: string): string {
    if (callbackId.includes('_')) {
      return callbackId.slice(callbackId.indexOf('_') + 1, callbackId.length);
    } else {
      return '';
    }
  }
  /**
   * Retrieves a Slack user id from the various fields in which a userId can exist inside of a bot response.
   */
  public getBotId(
    fromText: string | undefined,
    fromAttachmentText: string | undefined,
    fromPretext: string | undefined,
    fromCallbackId: string | undefined,
    fromBlocksId?: string | undefined,
  ): string | undefined {
    return fromText || fromAttachmentText || fromPretext || fromCallbackId || fromBlocksId;
  }
  /**
   * Determines whether or not a user is trying to @user, @channel or @here while muzzled.
   */
  public containsTag(text: string | undefined): boolean {
    if (!text) {
      return false;
    }

    return text.includes('<!channel>') || text.includes('<!here>') || !!this.getUserId(text);
  }

  public getAndSaveAllChannels(): void {
    this.web.getAllChannels().then(result => this.persistenceService.saveChannels(result.channels));
  }

  public async getChannelName(channelId: string, teamId: string): Promise<string> {
    const channel = await this.persistenceService.getChannelById(channelId, teamId);
    return channel?.name || '';
  }

  /**
   * Retrieves a list of all users.
   */
  public getAllUsers(): Promise<SlackUser[]> {
    console.log('Retrieving new user list...');
    return this.web
      .getAllUsers()
      .then(resp => {
        console.log('New user list has been retrieved!');
        this.persistenceService.saveUsers(resp.members as SlackUser[]);
        return resp.members as SlackUser[];
      })
      .catch(e => {
        console.error('Failed to retrieve users', e);
        console.timeEnd('retrieved user list in: ');
        console.error('Retrying in 5 seconds...');
        setTimeout(() => this.getAllUsers(), 5000);
        throw new Error('Unable to retrieve users');
      });
  }

  public getBotByBotId(botId: string, teamId: string): Promise<SlackUserFromDB | undefined> {
    return this.persistenceService.getBotByBotId(botId, teamId);
  }

  public getUserById(userId: string, teamId: string): Promise<SlackUserFromDB | undefined> {
    return this.persistenceService.getUserById(userId, teamId);
  }
}
