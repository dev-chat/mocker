import { CounterService } from '../counter/counter.service';
import { Muzzle } from '../shared/db/models/Muzzle';
import { SuppressorService } from '../shared/services/suppressor.service';
import { StorePersistenceService } from '../store/store.persistence.service';
import { MAX_MUZZLES, MAX_SUPPRESSIONS } from './constants';
import { getTimeString, getTimeToMuzzle } from './muzzle-utilities';


export class MuzzleService extends SuppressorService {
  private counterService = new CounterService();
  private storePersistenceService = StorePersistenceService.getInstance();

  public permaMuzzle(impersonatingUserId: string, teamId: string): Promise<Muzzle> {
    console.log(`perma-muzzling ${impersonatingUserId}`);

    return this.muzzlePersistenceService.addPermaMuzzle(impersonatingUserId, teamId);
  }

  public removePermaMuzzle(impersonatingUserId: string, teamId: string): Promise<boolean> {
    console.log('removing perma-muzzle for', impersonatingUserId);
    return this.muzzlePersistenceService.removePermaMuzzle(impersonatingUserId, teamId);
  }

  public async addUserToMuzzled(userId: string, requestorId: string, teamId: string, channel: string): Promise<string> {
    const shouldBackFire = await this.shouldBackfire(requestorId, teamId);
    const userName = await this.slackService.getUserNameById(userId, teamId);
    const requestorName = await this.slackService.getUserNameById(requestorId, teamId);
    const counter = this.counterPersistenceService.getCounterByRequestorId(userId);
    const protectedUser = await this.storePersistenceService.isProtected(userId, teamId);
    const isBot = await this.isBot(userId, teamId);

    return new Promise(async (resolve, reject) => {
      if (isBot) {
        reject('Sorry, you cannot muzzle bots.');
      } else if (!userId) {
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
            this.webService
              .sendMessage(
                channel,
                `:boom: <@${requestorId}> attempted to muzzle <@${userId}> but it backfired! :boom:`,
              )
              .catch(e => console.error(e));
            resolve(`:boom: Backfired! Better luck next time... :boom:`);
          })
          .catch((e: unknown) => {
            console.error(e);
            reject(`Muzzle failed!`);
          });
      } else if (protectedUser) {
        await this.muzzlePersistenceService.setRequestorCount(requestorId, teamId);
        this.webService
          .sendMessage(
            channel,
            `:innocent: <@${requestorId}> attempted to muzzle <@${userId}> but he was protected by a \`Guardian Angel\`. <@${requestorId}> is now muzzled. :innocent:`,
          )
          .catch(e => console.error(e));

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
          .catch((e: unknown) => {
            console.error(e);
            reject(`Muzzle failed!`);
          });
      }
    });
  }

  public async sendMuzzledMessage(
    channel: string,
    userId: string,
    teamId: string,
    text: string,
    timestamp: string,
  ): Promise<void> {
    console.time('send-muzzled-message');
    const muzzle = await this.muzzlePersistenceService.getMuzzle(userId, teamId).catch(e => {
      console.error('error retrieving muzzle', e);
      return null;
    });
    if (muzzle) {
      const suppressions = await this.muzzlePersistenceService.getSuppressions(userId, teamId);
      if (!suppressions || (suppressions && +suppressions < MAX_SUPPRESSIONS)) {
        await this.muzzlePersistenceService.incrementStatefulSuppressions(userId, teamId);
        this.sendSuppressedMessage(channel, userId, text, timestamp, muzzle, this.muzzlePersistenceService);
      } else {
        this.muzzlePersistenceService.trackDeletedMessage(muzzle, text);
      }
    }
    console.timeEnd('send-muzzled-message');
  }
}
