import { MAX_MUZZLES, MAX_SUPPRESSIONS } from './constants';
import { getTimeString, getTimeToMuzzle, shouldBackfire } from './muzzle-utilities';
import { SuppressorService } from '../../shared/services/suppressor.service';
import { CounterService } from '../counter/counter.service';

export class MuzzleService extends SuppressorService {
  private counterService = new CounterService();

  /**
   * Adds a user to the muzzled map and sets a timeout to remove the muzzle within a random time of 30 seconds to 3 minutes
   */
  public async addUserToMuzzled(userId: string, requestorId: string, channel: string): Promise<string> {
    const shouldBackFire = shouldBackfire();
    const userName = await this.slackService.getUserNameById(userId);
    const requestorName = await this.slackService.getUserNameById(requestorId);
    const counter = this.counterPersistenceService.getCounterByRequestorId(userId);

    return new Promise(async (resolve, reject) => {
      if (!userId) {
        reject(`Invalid username passed in. You can only muzzle existing slack users.`);
      } else if (await this.muzzlePersistenceService.isUserMuzzled(userId)) {
        console.error(
          `${requestorName} | ${requestorId} attempted to muzzle ${userName} | ${userId} but ${userName} | ${userId} is already muzzled.`,
        );
        reject(`${userName} is already muzzled!`);
      } else if (await this.muzzlePersistenceService.isUserMuzzled(requestorId)) {
        console.error(
          `User: ${requestorName} | ${requestorId}  attempted to muzzle ${userName} | ${userId} but failed because requestor: ${requestorName} | ${requestorId}  is currently muzzled`,
        );
        reject(`You can't muzzle someone if you are already muzzled!`);
      } else if (await this.muzzlePersistenceService.isMaxMuzzlesReached(requestorId)) {
        console.error(
          `User: ${requestorName} | ${requestorId}  attempted to muzzle ${userName} | ${userId} but failed because requestor: ${requestorName} | ${requestorId} has reached maximum muzzle of ${MAX_MUZZLES}`,
        );
        reject(`You're doing that too much. Only ${MAX_MUZZLES} muzzles are allowed per hour.`);
      } else if (counter) {
        console.log(`${requestorId} attempted to muzzle ${userId} but was countered!`);
        this.counterService.removeCounter(counter, true, userId, requestorId, channel);
        reject(`You've been countered! Better luck next time...`);
      } else if (shouldBackFire) {
        console.log(`Backfiring on ${requestorName} | ${requestorId} for attempting to muzzle ${userName} | ${userId}`);
        const timeToMuzzle = getTimeToMuzzle();
        await this.backfirePersistenceService
          .addBackfire(requestorId, timeToMuzzle)
          .then(() => {
            this.muzzlePersistenceService.setRequestorCount(requestorId);
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
      } else {
        const timeToMuzzle = getTimeToMuzzle();
        await this.muzzlePersistenceService
          .addMuzzle(requestorId, userId, timeToMuzzle)
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
  public async sendMuzzledMessage(channel: string, userId: string, text: string, timestamp: string): Promise<void> {
    console.time('send-muzzled-message');
    const muzzle: string | null = await this.muzzlePersistenceService.getMuzzle(userId);
    if (muzzle) {
      this.webService.deleteMessage(channel, timestamp);
      const suppressions = await this.muzzlePersistenceService.getSuppressions(userId);
      if (!suppressions || (suppressions && +suppressions < MAX_SUPPRESSIONS)) {
        await this.muzzlePersistenceService.incrementStatefulSuppressions(userId);
        this.webService.sendMessage(
          channel,
          `<@${userId}> says "${this.sendSuppressedMessage(text, +muzzle, this.muzzlePersistenceService)}"`,
        );
      } else {
        this.muzzlePersistenceService.trackDeletedMessage(+muzzle, text);
      }
    }
    console.timeEnd('send-muzzled-message');
  }
}
