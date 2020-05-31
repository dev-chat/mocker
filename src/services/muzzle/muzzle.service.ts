import { Muzzled } from '../../shared/models/muzzle/muzzle-models';
import { EventRequest } from '../../shared/models/slack/slack-models';
import { BackFirePersistenceService } from '../backfire/backfire.persistence.service';
import { CounterPersistenceService } from '../counter/counter.persistence.service';
import { CounterService } from '../counter/counter.service';
import { SlackService } from '../slack/slack.service';
import { WebService } from '../web/web.service';
import { MAX_MUZZLES, MAX_SUPPRESSIONS, REPLACEMENT_TEXT, MAX_WORD_LENGTH } from './constants';
import { getTimeString, getTimeToMuzzle, isRandomEven, shouldBackfire } from './muzzle-utilities';
import { MuzzlePersistenceService } from './muzzle.persistence.service';

export class MuzzleService {
  private webService = WebService.getInstance();
  private slackService = SlackService.getInstance();
  private counterService = new CounterService();
  private backfirePersistenceService = BackFirePersistenceService.getInstance();
  private muzzlePersistenceService = MuzzlePersistenceService.getInstance();
  private counterPersistenceService = CounterPersistenceService.getInstance();
  private userIdRegEx = /[<]@\w+/gm;
  /**
   * Takes in text and randomly muzzles certain words.
   */
  public muzzle(text: string, muzzleId: number): string {
    const words = text.split(' ');

    let returnText = '';
    let wordsSuppressed = 0;
    let charactersSuppressed = 0;
    let replacementWord;

    for (let i = 0; i < words.length; i++) {
      replacementWord = this.getReplacementWord(
        words[i],
        i === 0,
        i === words.length - 1,
        REPLACEMENT_TEXT[Math.floor(Math.random() * REPLACEMENT_TEXT.length)],
      );
      if (replacementWord.includes(REPLACEMENT_TEXT[Math.floor(Math.random() * REPLACEMENT_TEXT.length)])) {
        wordsSuppressed++;
        charactersSuppressed += words[i].length;
      }
      returnText += replacementWord;
    }
    this.muzzlePersistenceService.incrementMessageSuppressions(muzzleId);
    this.muzzlePersistenceService.incrementCharacterSuppressions(muzzleId, charactersSuppressed);
    this.muzzlePersistenceService.incrementWordSuppressions(muzzleId, wordsSuppressed);
    return returnText;
  }

  public findUserIdInBlocks(obj: any, regEx: RegExp): string | undefined {
    let id;
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'string') {
        const found = obj[key].match(regEx);
        if (found) {
          id = obj[key];
          console.log(id);
          return obj[key];
        }
      }
      if (typeof obj[key] === 'object') {
        this.findUserIdInBlocks(obj[key], regEx);
      }
    });
    return id;
  }

  /**
   * Determines whether or not a bot message should be removed.
   */
  public shouldBotMessageBeMuzzled(request: EventRequest): boolean {
    console.log(request);
    if (
      (request.event.bot_id || request.event.subtype === 'bot_message') &&
      (!request.event.username || request.event.username.toLowerCase() !== 'muzzle')
    ) {
      let userIdByEventText;
      let userIdByAttachmentText;
      let userIdByAttachmentPretext;
      let userIdByCallbackId;
      let userIdByBlocks;

      if (request.event.blocks) {
        console.log('we got some blocks');
        const hasIdInBlock = this.findUserIdInBlocks(request.event.blocks, this.userIdRegEx);
        console.log('did we find an id in em', hasIdInBlock);
        if (hasIdInBlock) {
          userIdByBlocks = this.slackService.getUserId(request.event.text);
        }
      }

      if (request.event.text) {
        userIdByEventText = this.slackService.getUserId(request.event.text);
      }

      if (request.event.attachments && request.event.attachments.length) {
        userIdByAttachmentText = this.slackService.getUserId(request.event.attachments[0].text);
        userIdByAttachmentPretext = this.slackService.getUserId(request.event.attachments[0].pretext);

        if (request.event.attachments[0].callback_id) {
          userIdByCallbackId = this.slackService.getUserIdByCallbackId(request.event.attachments[0].callback_id);
        }
      }

      const finalUserId = this.slackService.getBotId(
        userIdByEventText,
        userIdByAttachmentText,
        userIdByAttachmentPretext,
        userIdByCallbackId,
        userIdByBlocks,
      );
      console.log(finalUserId);
      return !!(finalUserId && this.muzzlePersistenceService.isUserMuzzled(finalUserId));
    }
    return false;
  }

  /**
   * Adds a user to the muzzled map and sets a timeout to remove the muzzle within a random time of 30 seconds to 3 minutes
   */
  public addUserToMuzzled(userId: string, requestorId: string, channel: string): Promise<string> {
    const shouldBackFire = shouldBackfire();
    const userName = this.slackService.getUserName(userId);
    const requestorName = this.slackService.getUserName(requestorId);
    const counter = this.counterPersistenceService.getCounterByRequestorAndUserId(userId, requestorId);

    return new Promise(async (resolve, reject) => {
      if (!userId) {
        reject(`Invalid username passed in. You can only muzzle existing slack users.`);
      } else if (this.muzzlePersistenceService.isUserMuzzled(userId)) {
        console.error(
          `${requestorName} | ${requestorId} attempted to muzzle ${userName} | ${userId} but ${userName} | ${userId} is already muzzled.`,
        );
        reject(`${userName} is already muzzled!`);
      } else if (this.muzzlePersistenceService.isUserMuzzled(requestorId)) {
        console.error(
          `User: ${requestorName} | ${requestorId}  attempted to muzzle ${userName} | ${userId} but failed because requestor: ${requestorName} | ${requestorId}  is currently muzzled`,
        );
        reject(`You can't muzzle someone if you are already muzzled!`);
      } else if (this.muzzlePersistenceService.isMaxMuzzlesReached(requestorId)) {
        console.error(
          `User: ${requestorName} | ${requestorId}  attempted to muzzle ${userName} | ${userId} but failed because requestor: ${requestorName} | ${requestorId} has reached maximum muzzle of ${MAX_MUZZLES}`,
        );
        reject(`You're doing that too much. Only ${MAX_MUZZLES} muzzles are allowed per hour.`);
      } else if (counter) {
        console.log(`${requestorId} attempted to muzzle ${userId} but was countered!`);
        this.counterService.removeCounter(counter, true, channel);
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
  public sendMuzzledMessage(channel: string, userId: string, text: string, timestamp: string): void {
    console.time('send-muzzled-message');
    const muzzle: Muzzled | undefined = this.muzzlePersistenceService.getMuzzle(userId);
    if (muzzle) {
      this.webService.deleteMessage(channel, timestamp);
      if (muzzle!.suppressionCount < MAX_SUPPRESSIONS) {
        this.muzzlePersistenceService.setMuzzle(userId, {
          suppressionCount: ++muzzle!.suppressionCount,
          muzzledBy: muzzle!.muzzledBy,
          id: muzzle!.id,
          isCounter: muzzle!.isCounter,
          removalFn: muzzle!.removalFn,
        });
        this.webService.sendMessage(channel, `<@${userId}> says "${this.muzzle(text, muzzle!.id)}"`);
      } else {
        this.muzzlePersistenceService.trackDeletedMessage(muzzle!.id, text);
      }
    }
    console.timeEnd('send-muzzled-message');
  }

  public getReplacementWord(word: string, isFirstWord: boolean, isLastWord: boolean, replacementText: string): string {
    const text =
      isRandomEven() && word.length < MAX_WORD_LENGTH && word !== ' ' && !this.slackService.containsTag(word)
        ? `*${word}*`
        : replacementText;

    if ((isFirstWord && !isLastWord) || (!isFirstWord && !isLastWord)) {
      return `${text} `;
    }
    return text;
  }
}
