import { EventRequest } from '../models/slack/slack-models';
import { USER_ID_REGEX } from '../../services/counter/constants';
import { SlackService } from '../../services/slack/slack.service';
import { BackFirePersistenceService } from '../../services/backfire/backfire.persistence.service';
import { MuzzlePersistenceService } from '../../services/muzzle/muzzle.persistence.service';
import { CounterPersistenceService } from '../../services/counter/counter.persistence.service';
import { WebService } from '../../services/web/web.service';
import { isRandomEven } from '../../services/muzzle/muzzle-utilities';
import { MAX_WORD_LENGTH, REPLACEMENT_TEXT } from '../../services/muzzle/constants';

export class SuppressorService {
  public webService = WebService.getInstance();
  public slackService = SlackService.getInstance();
  public backfirePersistenceService = BackFirePersistenceService.getInstance();
  public muzzlePersistenceService = MuzzlePersistenceService.getInstance();
  public counterPersistenceService = CounterPersistenceService.getInstance();

  public findUserIdInBlocks(obj: any, regEx: RegExp): string | undefined {
    let id;
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'string') {
        const found = obj[key].match(regEx);
        if (found) {
          id = obj[key];
        }
      }
      if (typeof obj[key] === 'object') {
        id = this.findUserIdInBlocks(obj[key], regEx);
      }
    });
    return id;
  }

  public async isSuppressed(userId: string) {
    return (
      (await this.muzzlePersistenceService.isUserMuzzled(userId)) ||
      (await this.backfirePersistenceService.isBackfire(userId)) ||
      (await this.counterPersistenceService.isCounterMuzzled(userId))
    );
  }

  /**
   * Determines whether or not a bot message should be removed.
   */
  public async shouldBotMessageBeMuzzled(request: EventRequest): Promise<boolean> {
    if (
      (request.event.bot_id || request.event.subtype === 'bot_message') &&
      ((request.event.username && request.event.username.toLowerCase() !== 'muzzle') ||
        (request.event.bot_profile && request.event.bot_profile.name.toLowerCase() !== 'muzzle'))
    ) {
      console.log(request.event.bot_profile && request.event.bot_profile.name.toLowerCase() !== 'muzzle');
      let userIdByEventText;
      let userIdByAttachmentText;
      let userIdByAttachmentPretext;
      let userIdByCallbackId;
      let userIdByBlocks;

      if (request.event.blocks) {
        const hasIdInBlock = this.findUserIdInBlocks(request.event.blocks, USER_ID_REGEX);
        if (hasIdInBlock) {
          userIdByBlocks = this.slackService.getUserId(hasIdInBlock);
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
      return !!(
        finalUserId &&
        ((await this.muzzlePersistenceService.isUserMuzzled(finalUserId)) ||
          (await this.backfirePersistenceService.isBackfire(finalUserId)) ||
          (await this.counterPersistenceService.isCounterMuzzled(finalUserId)))
      );
    }
    return false;
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

  /**
   * Takes in text and randomly muzzles words.
   */
  public sendSuppressedMessage(
    text: string,
    id: number,
    persistenceService?: BackFirePersistenceService | MuzzlePersistenceService,
  ): string {
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

    if (persistenceService) {
      persistenceService.incrementMessageSuppressions(id);
      persistenceService.incrementCharacterSuppressions(id, charactersSuppressed);
      persistenceService.incrementWordSuppressions(id, wordsSuppressed);
    }

    return returnText;
  }
}
