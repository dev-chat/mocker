import { EventRequest, SlackUser } from '../models/slack/slack-models';
import { USER_ID_REGEX } from '../../services/counter/constants';
import { SlackService } from '../../services/slack/slack.service';
import { BackFirePersistenceService } from '../../services/backfire/backfire.persistence.service';
import { MuzzlePersistenceService } from '../../services/muzzle/muzzle.persistence.service';
import { CounterPersistenceService } from '../../services/counter/counter.persistence.service';
import { WebService } from '../../services/web/web.service';
import { isRandomEven } from '../../services/muzzle/muzzle-utilities';
import { MAX_WORD_LENGTH, REPLACEMENT_TEXT } from '../../services/muzzle/constants';
import { TranslationService } from './translation.service';
import moment from 'moment';

export class SuppressorService {
  public webService = WebService.getInstance();
  public slackService = SlackService.getInstance();
  public translationService = new TranslationService();
  public backfirePersistenceService = BackFirePersistenceService.getInstance();
  public muzzlePersistenceService = MuzzlePersistenceService.getInstance();
  public counterPersistenceService = CounterPersistenceService.getInstance();

  public isBot(userId: string, teamId: string): Promise<boolean | undefined> {
    return this.slackService.getUserById(userId, teamId).then(user => !!user?.isBot);
  }

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

  // Built for spoiler only. This will not work on other block apps. Should improve this to be universal.
  public async findUserInBlocks(blocks: any, users?: SlackUser[]): Promise<string | undefined> {
    const allUsers: SlackUser[] = users ? users : await this.slackService.getAllUsers();
    let id;
    const firstBlock = blocks[0]?.elements?.[0];
    if (firstBlock) {
      Object.keys(firstBlock).forEach(key => {
        if (typeof firstBlock[key] === 'string') {
          allUsers.forEach(user => {
            if (firstBlock[key].includes(user.name)) {
              id = user.id;
            }
          });
        }
        if (typeof firstBlock[key] === 'object') {
          id = this.findUserInBlocks(firstBlock[key], allUsers);
        }
      });
    }
    return id;
  }

  public async isSuppressed(userId: string, teamId: string): Promise<boolean> {
    return (
      (await this.muzzlePersistenceService.isUserMuzzled(userId, teamId)) ||
      (await this.backfirePersistenceService.isBackfire(userId, teamId)) ||
      (await this.counterPersistenceService.isCounterMuzzled(userId))
    );
  }

  public async removeSuppression(userId: string, teamId: string): Promise<void> {
    const isMuzzled = await this.muzzlePersistenceService.isUserMuzzled(userId, teamId);
    const isBackfired = await this.backfirePersistenceService.isBackfire(userId, teamId);
    const isCountered = await this.counterPersistenceService.isCounterMuzzled(userId);
    console.log('Removing suppression for ', userId, ' on team ', teamId);
    if (isCountered) {
      console.log('Removing counter for ', userId);
      // This should takea teamId but doesnt because we never finished converting counter.persistence to redis.
      await this.counterPersistenceService.removeCounterMuzzle(userId);
    }

    if (isMuzzled) {
      console.log('Removing muzzle for ', userId, teamId);
      await this.muzzlePersistenceService.removeMuzzle(userId, teamId);
    }

    if (isBackfired) {
      console.log('Removing backfire for ', userId);
      await this.backfirePersistenceService.removeBackfire(userId, teamId);
    }
  }
  /**
   * Determines whether or not a bot message should be removed.
   */
  public async shouldBotMessageBeMuzzled(request: EventRequest): Promise<boolean> {
    const isBot = request.event.bot_id
      ? await this.slackService
          .getBotByBotId(request.event.bot_id, request.team_id)
          .then(user => user?.name !== 'muzzle' && user?.slackId !== 'ULG8SJRFF')
      : false;

    if (isBot) {
      let userIdByEventText;
      let userIdByAttachmentText;
      let userIdByAttachmentPretext;
      let userIdByCallbackId;
      let userIdByBlocks;

      if (request.event.blocks) {
        const userId = this.findUserIdInBlocks(request.event.blocks, USER_ID_REGEX);
        const userName = await this.findUserInBlocks(request.event.blocks);
        console.log('ID found for spoiler muzzle:' + userName);
        if (userId) {
          userIdByBlocks = this.slackService.getUserId(userId);
        }

        if (userName) {
          userIdByBlocks = userName;
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
        ((await this.muzzlePersistenceService.isUserMuzzled(finalUserId, request.team_id)) ||
          (await this.backfirePersistenceService.isBackfire(finalUserId, request.team_id)) ||
          (await this.counterPersistenceService.isCounterMuzzled(finalUserId)))
      );
    }
    return false;
  }

  public getFallbackReplacementWord(
    word: string,
    isFirstWord: boolean,
    isLastWord: boolean,
    replacementText: string,
  ): string {
    const text =
      isRandomEven() && word.length < MAX_WORD_LENGTH && word !== ' ' && !this.slackService.containsTag(word)
        ? `*${word}*`
        : replacementText;

    if ((isFirstWord && !isLastWord) || (!isFirstWord && !isLastWord)) {
      return `${text} `;
    }
    return text;
  }

  public logTranslateSuppression(
    text: string,
    id: number,
    persistenceService?: BackFirePersistenceService | MuzzlePersistenceService | CounterPersistenceService,
  ): void {
    const sentence = text.trim();
    const words = sentence.split(' ');
    let wordsSuppressed = 0;
    let charactersSuppressed = 0;

    for (let i = 0; i < words.length; i++) {
      wordsSuppressed++;
      charactersSuppressed += words[i].length;
    }

    if (persistenceService) {
      persistenceService.incrementMessageSuppressions(id);
      persistenceService.incrementCharacterSuppressions(id, charactersSuppressed);
      persistenceService.incrementWordSuppressions(id, wordsSuppressed);
    }
  }

  public async sendSuppressedMessage(
    channel: string,
    userId: string,
    text: string,
    timestamp: string,
    dbId: number,
    persistenceService: MuzzlePersistenceService | BackFirePersistenceService | CounterPersistenceService,
  ): Promise<void> {
    const textWithFallbackReplacments = text
      .split(' ')
      .map((word, idx) =>
        this.getFallbackReplacementWord(
          word,
          idx === 0,
          idx === text.length - 1,
          REPLACEMENT_TEXT[Math.floor(Math.random() * REPLACEMENT_TEXT.length)],
        ),
      )
      .join(' ');

    const suppressedMessage = await this.translationService.translate(textWithFallbackReplacments).catch(e => {
      console.error('error on translation');
      console.error(e);
      return null;
    });

    if (suppressedMessage === null) {
      this.sendFallbackSuppressedMessage(text, dbId, persistenceService);
    } else {
      await this.logTranslateSuppression(text, dbId, persistenceService);
      await this.webService.deleteMessage(channel, timestamp);
      await this.webService.sendMessage(channel, `<@${userId}> says "${text}"`);
    }
  }

  /**
   * Takes in text and randomly muzzles words.
   */
  public sendFallbackSuppressedMessage(
    text: string,
    id: number,
    persistenceService?: BackFirePersistenceService | MuzzlePersistenceService | CounterPersistenceService,
  ): string {
    const sentence = text.trim();
    const words = sentence.split(' ');

    let returnText = '';
    let wordsSuppressed = 0;
    let charactersSuppressed = 0;
    let replacementWord;

    for (let i = 0; i < words.length; i++) {
      replacementWord = this.getFallbackReplacementWord(
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

  public async shouldBackfire(requestorId: string, teamId: string): Promise<boolean> {
    const start = moment()
      .startOf('day')
      .subtract(7, 'days')
      .format('YYYY-MM-DD HH:mm:ss');
    const end = moment().format('YYYY-MM-DD HH:mm:ss');
    const muzzles = await this.muzzlePersistenceService.getMuzzlesByTimePeriod(requestorId, teamId, start, end);
    const chanceOfBackfire = 0.05 + muzzles * 0.025;
    console.log(`Chance of Backfire for ${requestorId}: ${chanceOfBackfire}`);
    return Math.random() <= chanceOfBackfire;
  }
}
