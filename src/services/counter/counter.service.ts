import { CounterMuzzle } from '../../shared/models/counter/counter-models';
import { MAX_SUPPRESSIONS, REPLACEMENT_TEXT, MAX_WORD_LENGTH } from '../muzzle/constants';
import { getTimeString, isRandomEven } from '../muzzle/muzzle-utilities';
import { COUNTER_TIME } from './constants';
import { SuppressorService } from '../../shared/services/suppressor.service';

export class CounterService extends SuppressorService {
  /**
   * Creates a counter in DB and stores it in memory.
   */
  public createCounter(requestorId: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      if (!requestorId) {
        reject(`Invalid user. Only existing slack users can counter.`);
      } else if (this.counterPersistenceService.getCounterByRequestorId(requestorId)) {
        reject('You already have a counter for this user.');
      } else {
        await this.counterPersistenceService
          .addCounter(requestorId)
          .then(() => {
            resolve(`Counter set for the next ${getTimeString(COUNTER_TIME)}`);
          })
          .catch(e => reject(e));
      }
    });
  }

  public getCounterByRequestorId(requestorId: string): number | undefined {
    return this.counterPersistenceService.getCounterByRequestorId(requestorId);
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
      isRandomEven() && word.length < MAX_WORD_LENGTH && word !== ' ' && !this.slackService.containsTag(word)
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

  public removeCounter(id: number, isUsed: boolean, userId: string, requestorId: string, channel: string): void {
    this.counterPersistenceService.removeCounter(id, isUsed, channel, requestorId);
    if (isUsed && channel) {
      this.counterPersistenceService.counterMuzzle(requestorId, id);
      this.muzzlePersistenceService.removeMuzzlePrivileges(requestorId);
      this.webService.sendMessage(
        channel,
        `:crossed_swords: <@${userId}> successfully countered <@${requestorId}>! <@${requestorId}> has lost muzzle privileges for one hour and is muzzled for the next 5 minutes! :crossed_swords:`,
      );
    }
  }
}
