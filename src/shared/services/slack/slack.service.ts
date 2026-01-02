import axios from 'axios';
import { WebService } from '../web/web.service';
import { USER_ID_REGEX } from './constants';
import { SlackPersistenceService } from './slack.persistence.service';
import { ChannelResponse, EventRequest, SlackUser } from '../../models/slack/slack-models';
import { SlackUser as SlackUserFromDB } from '../../db/models/SlackUser';
import { logger } from '../../logger/logger';

export class SlackService {
  private web: WebService = new WebService();
  private persistenceService: SlackPersistenceService = new SlackPersistenceService();
  logger = logger.child({ module: 'SlackService' });

  public sendResponse(responseUrl: string, response: ChannelResponse): void {
    axios
      .post(encodeURI(responseUrl), response)
      .catch((e: Error) => this.logger.error(`Error responding: ${e.message} at ${responseUrl}`));
  }

  /**
   * Retrieves the first user id from a string.
   * Expected format is <@U235KLKJ>
   */
  public getUserId(user: string): string | undefined {
    if (!user) {
      return undefined;
    }
    const regArray = user.match(USER_ID_REGEX);
    return regArray ? regArray[0].slice(2) : undefined;
  }

  /**
   * Retrieves all user IDs mentioned in a string.
   * Expected format is <@U235KLKJ> for each mention.
   */
  public getAllUserIds(text: string): string[] {
    if (!text) {
      return [];
    }
    const matches = text.match(USER_ID_REGEX);
    return matches ? matches.map((match) => match.slice(2)) : [];
  }

  /**
   * Checks if a specific user ID is mentioned anywhere in the text.
   */
  public isUserMentioned(text: string, userId: string): boolean {
    return this.getAllUserIds(text).includes(userId);
  }

  public getUserIdByName(userName: string, teamId: string): Promise<string | undefined> {
    return this.persistenceService.getUserByUserName(userName, teamId).then((user) => user?.slackId);
  }

  /**
   * Returns the user name by id
   */
  public getUserNameById(userId: string, teamId: string): Promise<string | undefined> {
    return this.persistenceService.getUserById(userId, teamId).then((user) => user?.name);
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
    fromText?: string,
    fromAttachmentText?: string,
    fromPretext?: string,
    fromCallbackId?: string,
    fromBlocksId?: string,
    fromBlocksIdSpoiler?: string,
  ): string | undefined {
    return fromText || fromAttachmentText || fromPretext || fromCallbackId || fromBlocksId || fromBlocksIdSpoiler;
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
    this.web.getAllChannels().then((result) => this.persistenceService.saveChannels(result.channels));
  }

  public async getChannelName(channelId: string, teamId: string): Promise<string> {
    const channel = await this.persistenceService.getChannelById(channelId, teamId);
    return channel?.name || '';
  }

  public getImpersonatedUser(userId: string): Promise<SlackUser | undefined> {
    return this.web.getAllUsers().then((resp) => {
      const potentialImpersonator = (resp.members as SlackUser[]).find((user: SlackUser) => user.id === userId);
      return (resp.members as SlackUser[]).find((victim: SlackUser) => {
        const hasSameDisplayName =
          !!victim?.profile?.display_name &&
          victim?.profile?.display_name?.toLowerCase() === potentialImpersonator?.profile?.display_name?.toLowerCase();
        const hasSameRealName =
          !!victim?.profile?.real_name &&
          victim?.profile?.real_name?.toLowerCase() === potentialImpersonator?.profile.real_name?.toLowerCase();

        return (hasSameDisplayName || hasSameRealName) && victim.id !== potentialImpersonator?.id;
      });
    });
  }

  /**
   * Retrieves a list of all users.
   */
  public async getAllUsers(): Promise<SlackUserFromDB[]> {
    this.logger.info('Retrieving new user list...');
    const cached = await this.persistenceService.getCachedUsers();
    if (!!cached) {
      return cached as SlackUserFromDB[];
    }
    return this.web
      .getAllUsers()
      .then((resp) => {
        this.logger.info('New user list has been retrieved!');
        return this.persistenceService.saveUsers(resp.members as SlackUser[]).catch((e) => e);
      })
      .catch((e) => {
        this.logger.error('Failed to retrieve users', e);
        this.logger.warn('Retrying in 60 seconds...');
        setTimeout(() => this.getAllUsers(), 60000);
        throw new Error('Unable to retrieve users');
      });
  }

  public getBotByBotId(botId: string, teamId: string): Promise<SlackUserFromDB | null> {
    return this.persistenceService.getBotByBotId(botId, teamId);
  }

  public getUserById(userId: string, teamId: string): Promise<SlackUserFromDB | null> {
    return this.persistenceService.getUserById(userId, teamId);
  }

  public handle(request: EventRequest): void {
    if (request.event.type === 'team_join') {
      this.getAllUsers().catch((e) => this.logger.error('Error handling team join event:', e));
    } else if (request.event.type === 'channel_created') {
      this.getAndSaveAllChannels();
    }
  }
}
