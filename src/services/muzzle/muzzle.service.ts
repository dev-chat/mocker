import { MAX_MUZZLES, MAX_SUPPRESSIONS } from './constants';
import { getTimeString, getTimeToMuzzle, shouldBackfire } from './muzzle-utilities';
import { SuppressorService } from '../../shared/services/suppressor.service';
import { CounterService } from '../counter/counter.service';
import { StorePersistenceService } from '../store/store.persistence.service';

export class MuzzleService extends SuppressorService {
  private counterService = new CounterService();
  private storePersistenceService = StorePersistenceService.getInstance();
  /**
   * Adds a user to the muzzled map and sets a timeout to remove the muzzle within a random time of 30 seconds to 3 minutes
   */
  public async addUserToMuzzled(userId: string, requestorId: string, teamId: string, channel: string): Promise<string> {
    const shouldBackFire = shouldBackfire();
    const userName = await this.slackService.getUserNameById(userId, teamId);
    const requestorName = await this.slackService.getUserNameById(requestorId, teamId);
    const counter = this.counterPersistenceService.getCounterByRequestorId(userId);
    const protectedUser = await this.storePersistenceService.isProtected(userId, teamId);

    return new Promise(async (resolve, reject) => {
      if (!userId) {
        reject(`Invalid username passed in. You can only muzzle existing slack users.`);
      } else if (await this.isSuppressed(userId, teamId)) {
        console.error(
          `${requestorName} | ${requestorId} attempted to muzzle ${userName} | ${userId} but ${userName} | ${userId} is already muzzled.`,
        );
        reject(`${userName} is already muzzled!`);
      } else if (await this.isSuppressed(requestorId, teamId)) {
        console.error(
          `User: ${requestorName} | ${requestorId}  attempted to muzzle ${userName} | ${userId} but failed because requestor: ${requestorName} | ${requestorId}  is currently muzzled`,
        );
        reject(`You can't muzzle someone if you are already muzzled!`);
      } else if (counter) {
        console.log(`${requestorId} attempted to muzzle ${userId} but was countered!`);
        this.counterService.removeCounter(counter, true, userId, requestorId, channel, teamId);
        reject(`You've been countered! Better luck next time...`);
      } else if (shouldBackFire) {
        console.log(`Backfiring on ${requestorName} | ${requestorId} for attempting to muzzle ${userName} | ${userId}`);
        const timeToMuzzle =
          getTimeToMuzzle() + (await this.storePersistenceService.getTimeModifiers(requestorId, teamId));
        await this.backfirePersistenceService
          .addBackfire(requestorId, timeToMuzzle, teamId)
          .then(() => {
            this.muzzlePersistenceService.setRequestorCount(requestorId, teamId);
            this.webService.sendMessage(
              channel,
              `:boom: <@${requestorId}> attempted to muzzle <@${userId}> but it backfired! :boom:`,
            );
            resolve(`:boom: Backfired! Better luck next time... :boom:`);
          })
          .catch((e: any) => {
            console.error(e);
            reject(`Muzzle failed!`);
          });
      } else if (protectedUser) {
        await this.muzzlePersistenceService.setRequestorCount(requestorId, teamId);
        this.webService.sendMessage(
          channel,
          `:innocent: <@${requestorId}> attempted to muzzle <@${userId}> but he was protected by a \`Guardian Angel\`. <@${requestorId}> is now muzzled. :innocent:`,
        );

        const userToCredit = await this.storePersistenceService
          .getUserOfUsedItem(protectedUser)
          .then(user => user!.split('-')[0]);
        const timeToMuzzle =
          getTimeToMuzzle() + (await this.storePersistenceService.getTimeModifiers(userToCredit, teamId));
        const protectedUserArr = protectedUser.split('.');
        const defensiveItemId = protectedUserArr[protectedUserArr.length - 1];
        await this.muzzlePersistenceService.addMuzzle(userToCredit, requestorId, teamId, timeToMuzzle, defensiveItemId);
        resolve(':innocent: The Light shines upon your enemy. :innocent:');
      } else if (await this.muzzlePersistenceService.isMaxMuzzlesReached(requestorId, teamId)) {
        console.error(
          `User: ${requestorName} | ${requestorId}  attempted to muzzle ${userName} | ${userId} but failed because requestor: ${requestorName} | ${requestorId} has reached maximum muzzle of ${MAX_MUZZLES}`,
        );
        reject(`You're doing that too much. Only ${MAX_MUZZLES} muzzles are allowed per hour.`);
      } else {
        const timeToMuzzle =
          getTimeToMuzzle() + (await this.storePersistenceService.getTimeModifiers(requestorId, teamId));
        await this.muzzlePersistenceService
          .addMuzzle(requestorId, userId, teamId, timeToMuzzle)
          .then(() => {
            resolve(`Successfully muzzled ${userName} for ${getTimeString(timeToMuzzle)}`);
          })
          .catch((e: any) => {
            console.error(e);
            reject(`Muzzle failed!`);
          });
      }
    });
  }

  /**
   * Wrapper for sendMessage that handles suppression in memory and, if max suppressions are reached, handles suppression storage to disk.
   */
  public async sendMuzzledMessage(
    channel: string,
    userId: string,
    teamId: string,
    text: string,
    timestamp: string,
  ): Promise<void> {
    console.time('send-muzzled-message');
    const muzzle: string | null = await this.muzzlePersistenceService.getMuzzle(userId, teamId);
    if (muzzle) {
      this.webService.deleteMessage(channel, timestamp);
      const suppressions = await this.muzzlePersistenceService.getSuppressions(userId, teamId);
      if (!suppressions || (suppressions && +suppressions < MAX_SUPPRESSIONS)) {
        await this.muzzlePersistenceService.incrementStatefulSuppressions(userId, teamId);
        const language = this.translationService.getRandomLanguage();
        let suppressedMessage: string | null;
        if (language === 'en') {
          suppressedMessage = this.sendSuppressedMessage(text, +muzzle, this.muzzlePersistenceService);
        } else {
          suppressedMessage = await this.translationService.translate(text, language).catch(e => {
            console.error('error on translation');
            console.error(e);
            return null;
          });
          if (suppressedMessage === null) {
            this.sendSuppressedMessage(text, +muzzle, this.muzzlePersistenceService);
          } else {
            await this.logTranslateSuppression(text, +muzzle, this.muzzlePersistenceService);
          }
        }

        this.webService.sendMessage(channel, `<@${userId}> says "${suppressedMessage}"`);
      } else {
        this.muzzlePersistenceService.trackDeletedMessage(+muzzle, text);
      }
    }
    console.timeEnd('send-muzzled-message');
  }
}
