import { CounterMuzzle } from '../../shared/models/counter/counter-models';
import { EventRequest } from '../../shared/models/slack/slack-models';
import { MAX_SUPPRESSIONS, REPLACEMENT_TEXT } from '../muzzle/constants';
import { getTimeString, isRandomEven } from '../muzzle/muzzle-utilities';
import { MuzzlePersistenceService } from '../muzzle/muzzle.persistence.service';
import { SlackService } from '../slack/slack.service';
import { WebService } from '../web/web.service';
import { COUNTER_TIME } from './constants';
import { CounterPersistenceService } from './counter.persistence.service';

export class CounterService {
  private slackService = SlackService.getInstance();
  private webService = WebService.getInstance();
  private muzzlePersistenceService = MuzzlePersistenceService.getInstance();
  private counterPersistenceService = CounterPersistenceService.getInstance();

  /**
   * Creates a counter in DB and stores it in memory.
   */
  public createCounter(counteredId: string, requestorId: string): Promise<string> {
    const counterUserName = this.slackService.getUserName(counteredId);
    return new Promise(async (resolve, reject) => {
      if (!counteredId || !requestorId) {
        reject(`Invalid username passed in. You can only counter existing slack users.`);
      } else if (this.counterPersistenceService.getCounterByRequestorAndUserId(requestorId, counteredId)) {
        reject('You already have a counter for this user.');
      } else {
        await this.counterPersistenceService
          .addCounter(requestorId, counteredId)
          .then(() => {
            resolve(`Counter set for ${counterUserName} for the next ${getTimeString(COUNTER_TIME)}`);
          })
          .catch(e => reject(e));
      }
    });
  }

  public getCounterByRequestorAndUserId(requestorId: string, userId: string): number | undefined {
    return this.counterPersistenceService.getCounterByRequestorAndUserId(requestorId, userId);
  }

  public createCounterMuzzleMessage(text: string): string {
    const words = text.split(' ');

    let returnText = '';
    let replacementWord;

    for (let i = 0; i < words.length; i++) {
      replacementWord = this.getReplacementWord(
        words[i],
        i === 0,
        i === words.length - 1,
        REPLACEMENT_TEXT[Math.floor(Math.random() * REPLACEMENT_TEXT.length)],
      );
      returnText += replacementWord;
    }
    return returnText;
  }

  public getReplacementWord(word: string, isFirstWord: boolean, isLastWord: boolean, replacementText: string): string {
    const text =
      isRandomEven() && word.length < 10 && word !== ' ' && !this.slackService.containsTag(word)
        ? `*${word}*`
        : replacementText;

    if ((isFirstWord && !isLastWord) || (!isFirstWord && !isLastWord)) {
      return `${text} `;
    }
    return text;
  }

  public sendCounterMuzzledMessage(channel: string, userId: string, text: string, timestamp: string): void {
    const counterMuzzle: CounterMuzzle | undefined = this.counterPersistenceService.getCounterMuzzle(userId);
    if (counterMuzzle) {
      this.webService.deleteMessage(channel, timestamp);
      if (counterMuzzle!.suppressionCount < MAX_SUPPRESSIONS) {
        this.counterPersistenceService.setCounterMuzzle(userId, {
          suppressionCount: ++counterMuzzle!.suppressionCount,
          counterId: counterMuzzle!.counterId,
          removalFn: counterMuzzle!.removalFn,
        });
        this.webService.sendMessage(channel, `<@${userId}> says "${this.createCounterMuzzleMessage(text)}"`);
      }
    }
  }

  /**
   * Determines whether or not a bot message should be removed.
   */
  public shouldBotMessageBeMuzzled(request: EventRequest): boolean {
    let userIdByEventText;
    let userIdByAttachmentText;
    let userIdByAttachmentPretext;
    let userIdByCallbackId;

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
    );

    return !!(
      request.event.subtype === 'bot_message' &&
      finalUserId &&
      this.counterPersistenceService.isCounterMuzzled(finalUserId) &&
      request.event.username !== 'muzzle'
    );
  }

  public removeCounter(id: number, isUsed: boolean, channel?: string): void {
    const counter = this.counterPersistenceService.getCounter(id);
    this.counterPersistenceService.removeCounter(id, isUsed, channel);
    if (isUsed && channel) {
      this.counterPersistenceService.counterMuzzle(counter!.counteredId, id);
      this.muzzlePersistenceService.removeMuzzlePrivileges(counter!.counteredId);
      this.webService.sendMessage(
        channel,
        `:crossed_swords: <@${counter!.requestorId}> successfully countered <@${counter!.counteredId}>! <@${
          counter!.counteredId
        }> has lost muzzle privileges for one hour and is muzzled for the next 5 minutes! :crossed_swords:`,
      );
    }
  }
}
