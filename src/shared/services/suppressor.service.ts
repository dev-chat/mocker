import { EventRequest } from '../models/slack/slack-models';
import { USER_ID_REGEX } from '../../counter/constants';
import { CounterPersistenceService } from '../../counter/counter.persistence.service';
import { WebService } from './web/web.service';
import { TranslationService } from './translation.service';
import moment from 'moment';
import { SlackUser } from '../db/models/SlackUser';
import { AIService } from '../../ai/ai.service';
import { BackFirePersistenceService } from '../../backfire/backfire.persistence.service';
import { MAX_WORD_LENGTH, REPLACEMENT_TEXT } from '../../muzzle/constants';
import { isRandomEven } from '../../muzzle/muzzle-utilities';
import { MuzzlePersistenceService } from '../../muzzle/muzzle.persistence.service';
import { SlackService } from './slack/slack.service';
import { logger } from '../logger/logger';

export class SuppressorService {
  public webService = new WebService();
  public slackService = new SlackService();
  public translationService = new TranslationService();
  public backfirePersistenceService = new BackFirePersistenceService();
  public muzzlePersistenceService = new MuzzlePersistenceService();
  public counterPersistenceService = CounterPersistenceService.getInstance();
  public aiService = new AIService();
  logger = logger.child({ module: 'SuppressorService' });

  public isBot(userId: string, teamId: string): Promise<boolean | undefined> {
    return this.slackService.getUserById(userId, teamId).then((user) => !!user?.isBot);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public findUserIdInBlocks(obj: Record<any, any>, regEx: RegExp): string | undefined {
    let id;
    Object.keys(obj).forEach((key) => {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async findUserInBlocks(blocks: Record<any, any>[], users?: SlackUser[]): Promise<string | undefined> {
    const allUsers: SlackUser[] = users ? users : await this.slackService.getAllUsers();
    let id;
    const firstBlock = blocks[0]?.elements?.[0];
    if (firstBlock) {
      Object.keys(firstBlock).forEach((key) => {
        if (typeof firstBlock[key] === 'string') {
          allUsers?.forEach((user) => {
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
    if (isCountered) {
      await this.counterPersistenceService.removeCounterMuzzle(userId);
    }

    if (isMuzzled) {
      await this.muzzlePersistenceService.removeMuzzle(userId, teamId);
    }

    if (isBackfired) {
      await this.backfirePersistenceService.removeBackfire(userId, teamId);
    }
  }
  /**
   * Determines whether or not a bot message should be removed.
   */
  public async shouldBotMessageBeMuzzled(request: EventRequest): Promise<string | false> {
    if (!request.event.bot_id) {
      return false;
    }
    const bot = await this.slackService.getBotByBotId(request.event.bot_id, request.team_id);

    const isMuzzleBot = bot?.name === 'muzzle' || bot?.name === 'muzzle3';

    if (isMuzzleBot) {
      return false;
    }

    let userIdByEventText;
    let userIdByAttachmentText;
    let userIdByAttachmentPretext;
    let userIdByCallbackId;
    let userIdByBlocks;
    let userIdByBlocksSpoiler;

    if (request?.event?.blocks?.length) {
      const userId = this.findUserIdInBlocks(request.event.blocks, USER_ID_REGEX);
      const userName = await this.findUserInBlocks(request.event.blocks);

      if (userId) {
        userIdByBlocks = this.slackService.getUserId(userId);
      }

      if (userName) {
        userIdByBlocksSpoiler = userName;
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
      userIdByBlocksSpoiler,
    );
    if (
      !!(
        finalUserId &&
        ((await this.muzzlePersistenceService.isUserMuzzled(finalUserId, request.team_id)) ||
          (await this.backfirePersistenceService.isBackfire(finalUserId, request.team_id)) ||
          (await this.counterPersistenceService.isCounterMuzzled(finalUserId)))
      )
    ) {
      return finalUserId;
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

    try {
      if (persistenceService) {
        persistenceService.incrementMessageSuppressions(id);
        persistenceService.incrementCharacterSuppressions(id, charactersSuppressed);
        persistenceService.incrementWordSuppressions(id, wordsSuppressed);
      }
    } catch (e) {
      this.logger.error(e);
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
    await this.webService.deleteMessage(channel, timestamp, userId);

    const words = text?.split(' ');

    const shouldMuzzle = words?.length > 0 && words?.length <= 250;

    if (shouldMuzzle) {
      const textWithFallbackReplacments = words
        .map((word) =>
          word.length >= MAX_WORD_LENGTH ? REPLACEMENT_TEXT[Math.floor(Math.random() * REPLACEMENT_TEXT.length)] : word,
        )
        .join(' ');

      const shouldCorpo = channel === '#libworkchat' || (channel === 'C023B688SLT' && words.length > 10);

      if (shouldCorpo) {
        await this.aiService
          .generateCorpoSpeak(textWithFallbackReplacments)
          .then(async (corpoText) => {
            await this.logTranslateSuppression(text, dbId, persistenceService);
            await this.webService.sendMessage(channel, `<@${userId}> says "${corpoText}"`);
          })
          .catch(async (e) => {
            this.logger.error(e);
            const message = this.sendFallbackSuppressedMessage(text, dbId, persistenceService);
            await this.webService
              .sendMessage(channel, `<@${userId}> says "${message}"`)
              .catch((e) => this.logger.error(e));
            return null;
          });
      } else {
        await this.translationService
          .translate(textWithFallbackReplacments)
          .then(async (message) => {
            await this.logTranslateSuppression(text, dbId, persistenceService);
            await this.webService
              .sendMessage(channel, `<@${userId}> says "${message}"`)
              .catch((e) => this.logger.error(e));
          })
          .catch(async (e) => {
            this.logger.error(e);
            const message = this.sendFallbackSuppressedMessage(text, dbId, persistenceService);
            await this.webService
              .sendMessage(channel, `<@${userId}> says "${message}"`)
              .catch((e) => this.logger.error(e));
            return null;
          });
      }
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
    const start = moment().subtract(7, 'days').format('YYYY-MM-DD HH:mm:ss');
    const end = moment().format('YYYY-MM-DD HH:mm:ss');

    const muzzles = await this.muzzlePersistenceService.getMuzzlesByTimePeriod(requestorId, teamId, start, end);
    const chanceOfBackfire = 0.05 + muzzles * 0.1;
    return Math.random() <= chanceOfBackfire;
  }

  public async handleBotMessage(request: EventRequest): Promise<void> {
    const isReaction = request.event.type === 'reaction_added' || request.event.type === 'reaction_removed';
    const botUser = await this.shouldBotMessageBeMuzzled(request);
    if (botUser && !isReaction) {
      this.webService.deleteMessage(request.event.channel, request.event.ts, request.event.user);
      const muzzleId = await this.muzzlePersistenceService.getMuzzle(botUser, request.team_id);
      if (muzzleId) {
        this.muzzlePersistenceService.trackDeletedMessage(muzzleId, 'A bot message');
        return;
      }

      const backfireId = await this.backfirePersistenceService.getBackfireByUserId(botUser, request.team_id);
      if (backfireId) {
        this.backfirePersistenceService.trackDeletedMessage(backfireId, 'A bot user message');
        return;
      }

      const counter = await this.counterPersistenceService.getCounterMuzzle(botUser);

      if (counter?.counterId) {
        this.counterPersistenceService.incrementMessageSuppressions(counter.counterId);
        return;
      }
    }
  }
}
