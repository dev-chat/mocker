import { CounterService } from '../counter/counter.service';
import type { Muzzle } from '../shared/db/models/Muzzle';
import { logger } from '../shared/logger/logger';
import type { EventRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';
import { StorePersistenceService } from '../store/store.persistence.service';
import { ABUSE_PENALTY_TIME, MAX_MUZZLES, MAX_SUPPRESSIONS } from './constants';
import { getTimeString, getTimeToMuzzle } from './muzzle-utilities';

export class MuzzleService extends SuppressorService {
  counterService = new CounterService();
  storePersistenceService = new StorePersistenceService();
  logger = logger.child({ module: 'MuzzleService' });

  private getProfileChangedUserId(request: EventRequest): string | undefined {
    const eventUser = request.event.user;

    if (typeof eventUser === 'string') {
      return eventUser;
    }

    if (typeof eventUser === 'object') {
      const userId = Reflect.get(eventUser, 'id');
      return typeof userId === 'string' ? userId : undefined;
    }

    return undefined;
  }

  public permaMuzzle(impersonatingUserId: string, teamId: string): Promise<Muzzle> {
    return this.muzzlePersistenceService.addPermaMuzzle(impersonatingUserId, teamId);
  }

  public removePermaMuzzle(impersonatingUserId: string, teamId: string): Promise<boolean> {
    return this.muzzlePersistenceService.removePermaMuzzle(impersonatingUserId, teamId);
  }

  public async addUserToMuzzled(userId: string, requestorId: string, teamId: string, channel: string): Promise<string> {
    const shouldBackFire = await this.shouldBackfire(requestorId, teamId);
    const userName = await this.slackService.getUserNameById(userId, teamId);
    const requestorName = await this.slackService.getUserNameById(requestorId, teamId);
    const counter = this.counterPersistenceService.getCounterByRequestorId(userId);
    const protectedUser = await this.storePersistenceService.isProtected(userId, teamId);
    const isBot = await this.isBot(userId, teamId);

    if (isBot) {
      throw new Error('Sorry, you cannot muzzle bots.');
    }

    if (!userId) {
      throw new Error('Invalid username passed in. You can only muzzle existing slack users.');
    }

    if (await this.isSuppressed(userId, teamId)) {
      this.logger.error(
        `${requestorName} | ${requestorId} attempted to muzzle ${userName} | ${userId} but ${userName} | ${userId} is already muzzled.`,
      );
      throw new Error(`${userName} is already muzzled!`);
    }

    if (await this.isSuppressed(requestorId, teamId)) {
      this.logger.error(
        `User: ${requestorName} | ${requestorId}  attempted to muzzle ${userName} | ${userId} but failed because requestor: ${requestorName} | ${requestorId}  is currently muzzled`,
      );
      throw new Error(`You can't muzzle someone if you are already muzzled!`);
    }

    if (counter) {
      this.logger.info(`${requestorId} attempted to muzzle ${userId} but was countered!`);
      this.counterService.removeCounter(counter, true, userId, requestorId, channel, teamId);
      throw new Error(`You've been countered! Better luck next time...`);
    }

    if (shouldBackFire) {
      this.logger.info(
        `Backfiring on ${requestorName} | ${requestorId} for attempting to muzzle ${userName} | ${userId}`,
      );
      const timeToMuzzle =
        getTimeToMuzzle() + (await this.storePersistenceService.getTimeModifiers(requestorId, teamId));
      try {
        await this.backfirePersistenceService.addBackfire(requestorId, timeToMuzzle, teamId);
        void this.muzzlePersistenceService.setRequestorCount(requestorId, teamId);
        this.webService
          .sendMessage(channel, `:boom: <@${requestorId}> attempted to muzzle <@${userId}> but it backfired! :boom:`)
          .catch((e) => this.logger.error(e));
        return ':boom: Backfired! Better luck next time... :boom:';
      } catch (e: unknown) {
        this.logger.error(e);
        throw Object.assign(new Error('Muzzle failed!'), { cause: e });
      }
    }

    if (protectedUser) {
      await this.muzzlePersistenceService.setRequestorCount(requestorId, teamId);
      this.webService
        .sendMessage(
          channel,
          `:innocent: <@${requestorId}> attempted to muzzle <@${userId}> but he was protected by a \`Guardian Angel\`. <@${requestorId}> is now muzzled. :innocent:`,
        )
        .catch((e) => this.logger.error(e));

      const userToCredit = await this.storePersistenceService
        .getUserOfUsedItem(protectedUser)
        .then((user) => user!.split('-')[0]);
      const timeToMuzzle =
        getTimeToMuzzle() + (await this.storePersistenceService.getTimeModifiers(userToCredit, teamId));
      const protectedUserArr = protectedUser.split('.');
      const defensiveItemId = protectedUserArr[protectedUserArr.length - 1];
      await this.muzzlePersistenceService.addMuzzle(userToCredit, requestorId, teamId, timeToMuzzle, defensiveItemId);
      return ':innocent: The Light shines upon your enemy. :innocent:';
    }

    if (await this.muzzlePersistenceService.isMaxMuzzlesReached(requestorId, teamId)) {
      this.logger.error(
        `User: ${requestorName} | ${requestorId}  attempted to muzzle ${userName} | ${userId} but failed because requestor: ${requestorName} | ${requestorId} has reached maximum muzzle of ${MAX_MUZZLES}`,
      );
      throw new Error(`You're doing that too much. Only ${MAX_MUZZLES} muzzles are allowed per hour.`);
    }

    const timeToMuzzle = getTimeToMuzzle() + (await this.storePersistenceService.getTimeModifiers(requestorId, teamId));
    try {
      await this.muzzlePersistenceService.addMuzzle(requestorId, userId, teamId, timeToMuzzle);
      return `Successfully muzzled ${userName} for ${getTimeString(timeToMuzzle)}`;
    } catch (e: unknown) {
      this.logger.error(e);
      throw Object.assign(new Error('Muzzle failed!'), { cause: e });
    }
  }

  public async sendMuzzledMessage(
    channel: string,
    userId: string,
    teamId: string,
    text: string,
    timestamp: string,
  ): Promise<void> {
    const muzzle = await this.muzzlePersistenceService.getMuzzle(userId, teamId).catch((e) => {
      this.logger.error('error retrieving muzzle', e);
      return null;
    });
    if (muzzle) {
      const suppressions = await this.muzzlePersistenceService.getSuppressions(userId, teamId);
      if (!suppressions || (suppressions && +suppressions < MAX_SUPPRESSIONS)) {
        await this.muzzlePersistenceService.incrementStatefulSuppressions(userId, teamId);
        void this.sendSuppressedMessage(channel, userId, text, timestamp, muzzle, this.muzzlePersistenceService);
      } else {
        this.muzzlePersistenceService.trackDeletedMessage(muzzle, text);
      }
    }
  }

  async handleImpersonation(request: EventRequest) {
    const isUserProfileChanged = request.event.type === 'user_profile_changed';
    if (isUserProfileChanged) {
      const eventUserId = this.getProfileChangedUserId(request);
      if (!eventUserId) {
        this.logger.warn('Unable to resolve user id for user_profile_changed event');
        return;
      }

      const userWhoIsBeingImpersonated = await this.slackService.getImpersonatedUser(eventUserId);
      if (userWhoIsBeingImpersonated) {
        void this.permaMuzzle(eventUserId, request.team_id).then(() => {
          return this.webService
            .sendMessage(
              '#general',
              `:cop: <@${eventUserId}> is impersonating <@${userWhoIsBeingImpersonated.id}>! They are now muzzled until they assume their normal identity. :cop:`,
            )
            .catch((e) => this.logger.error(e));
        });
      } else {
        void this.removePermaMuzzle(eventUserId, request.team_id);
      }
    }
  }

  public async handle(request: EventRequest) {
    const isMessage =
      request.event.type === 'message' ||
      request.event.type === 'message.channels' ||
      request.event.type === 'message.app_home';
    const isTopicChange = !request.event.subtype || request.event.subtype === 'channel_topic';

    void this.handleImpersonation(request);

    if (isMessage || isTopicChange) {
      const isMuzzled = await this.muzzlePersistenceService.isUserMuzzled(request.event.user, request.team_id);
      if (isMuzzled) {
        const containsTag = this.slackService.containsTag(request.event.text);
        void this.webService.deleteMessage(request.event.channel, request.event.ts, request.event.user);
        if (!containsTag) {
          void this.sendMuzzledMessage(
            request.event.channel,
            request.event.user,
            request.team_id,
            request.event.text,
            request.event.ts,
          );
        } else if (isTopicChange) {
          const muzzleId = await this.muzzlePersistenceService.getMuzzle(request.event.user, request.team_id);
          if (muzzleId === undefined) {
            return;
          }

          void this.muzzlePersistenceService.addMuzzleTime(request.event.user, request.team_id, ABUSE_PENALTY_TIME);
          this.muzzlePersistenceService.trackDeletedMessage(muzzleId, request.event.text);
          this.webService
            .sendMessage(
              request.event.channel,
              `:rotating_light: <@${
                request.event.user
              }> attempted to @ while muzzled or change the channel topic! Muzzle increased by ${getTimeString(
                ABUSE_PENALTY_TIME,
              )} :rotating_light:`,
            )
            .catch((e) => this.logger.error(e));
        }
      }
    }
  }
}
