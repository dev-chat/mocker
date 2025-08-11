import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { MessageWithName } from '../shared/models/message/message-with-name';
import { HistoryPersistenceService } from '../shared/services/history.persistence.service';
import { EventRequest, SlashCommandRequest } from '../shared/models/slack/slack-models';
import { AIPersistenceService } from './ai.persistence';
import { KnownBlock } from '@slack/web-api';
import { WebService } from '../shared/services/web/web.service';
import { getChunks } from '../shared/util/getChunks';
import {
  CORPO_SPEAK_INSTRUCTIONS,
  GENERAL_TEXT_INSTRUCTIONS,
  GET_TAGGED_MESSAGE_INSTRUCTIONS,
  getHistoryInstructions,
  MAX_AI_REQUESTS_PER_DAY,
} from './ai.constants';
import { logger } from '../shared/logger/logger';
import { SlackService } from '../shared/services/slack/slack.service';
import { MuzzlePersistenceService } from '../muzzle/muzzle.persistence.service';
import { OpenAIService } from './openai/openai.service';

export class AIService {
  redis = new AIPersistenceService();
  openAiService = new OpenAIService();

  muzzlePersistenceService = new MuzzlePersistenceService();
  historyService = new HistoryPersistenceService();
  webService = new WebService();
  slackService = new SlackService();
  aiServiceLogger = logger.child({ module: 'AIService' });

  public decrementDaiyRequests(userId: string, teamId: string): Promise<string | null> {
    return this.redis.decrementDailyRequests(userId, teamId);
  }

  public isAlreadyInflight(userId: string, teamId: string): Promise<boolean> {
    return this.redis.getInflight(userId, teamId).then((x) => !!x);
  }

  public isAlreadyAtMaxRequests(userId: string, teamId: string): Promise<boolean> {
    return this.redis.getDailyRequests(userId, teamId).then((x) => Number(x) >= MAX_AI_REQUESTS_PER_DAY);
  }

  public async generateText(userId: string, teamId: string, channelId: string, text: string): Promise<void> {
    await this.redis.setInflight(userId, teamId);
    await this.redis.setDailyRequests(userId, teamId);

    return this.openAiService
      .generateText(text, userId, GENERAL_TEXT_INSTRUCTIONS)
      .then(async (result) => {
        await this.redis.removeInflight(userId, teamId);
        this.sendGptText(result, userId, teamId, channelId, text);
      })
      .catch(async (e) => {
        this.aiServiceLogger.error(e);
        await this.redis.removeInflight(userId, teamId);
        await this.redis.decrementDailyRequests(userId, teamId);
        throw e;
      });
  }

  public async writeToDiskAndReturnUrl(base64Image: string): Promise<string> {
    const dir = process.env.IMAGE_DIR ? process.env.IMAGE_DIR : path.join(__dirname, '../../../images');
    const filename = `${uuidv4()}.png`;
    const filePath = path.join(dir, filename);
    const base64Data = base64Image.replace(/^data:image\/png;base64,/, '');
    return new Promise((resolve, reject) =>
      fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) {
          this.aiServiceLogger.error('Error writing image to disk:', err);
          reject(err);
        }
        resolve(`https://muzzle.lol/${filename}`);
      }),
    );
  }

  public async redeployMoonbeam(): Promise<void> {
    const imagePrompt =
      'An image depicting yourself with the understanding that your name is Moonbeam and you identify as a female. The art style can be any choice you would like. Feel free to be creative, and do not feel that you must always present yourself in humanoid form. Please do not include any text in the image.';
    const textPrompt = `Provide a cryptic message about the future and humanity's role in it.`;
    const aiQuote = this.openAiService.generateText(textPrompt, 'Moonbeam').catch((e) => {
      this.aiServiceLogger.error(e);
    });

    const aiImage = this.openAiService.generateImage(imagePrompt, 'Moonbeam').then(async (x) => {
      if (x) {
        return this.writeToDiskAndReturnUrl(x);
      } else {
        this.aiServiceLogger.error(`No b64_json was returned by OpenAI for prompt: ${imagePrompt}`);
        throw new Error(`No b64_json was returned by OpenAI for prompt: ${imagePrompt}`);
      }
    });

    return Promise.all([aiImage, aiQuote])
      .then((results) => {
        const [imageUrl, quote] = results;
        const blocks: KnownBlock[] = [
          {
            type: 'image',
            image_url: imageUrl,
            alt_text: 'Moonbeam has been deployed.',
          },
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: 'Moonbeam has been deployed.',
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `"${quote}"`,
            },
          },
        ];
        this.webService.sendMessage('#muzzlefeedback', 'Moonbeam has been deployed.', blocks);
      })
      .catch((e) => {
        this.aiServiceLogger.error(e);
      });
  }

  public async generateImage(userId: string, teamId: string, channel: string, text: string): Promise<void> {
    await this.redis.setInflight(userId, teamId);
    await this.redis.setDailyRequests(userId, teamId);
    return this.openAiService
      .generateImage(text, userId)
      .then(async (x) => {
        await this.redis.removeInflight(userId, teamId);

        if (x) {
          return this.writeToDiskAndReturnUrl(x);
        } else {
          this.aiServiceLogger.error(`No b64_json was returned by OpenAI for prompt: ${text}`);
          throw new Error(`No b64_json was returned by OpenAI for prompt: ${text}`);
        }
      })
      .then((imageUrl) => {
        this.sendImage(imageUrl, userId, teamId, channel, text);
      })
      .catch(async (e) => {
        this.aiServiceLogger.error(e);
        await this.redis.removeInflight(userId, teamId);
        await this.redis.decrementDailyRequests(userId, teamId);
        throw e;
      });
  }

  public generateCorpoSpeak(text: string): Promise<string | undefined> {
    return this.openAiService.generateText(text, 'Moonbeam', CORPO_SPEAK_INSTRUCTIONS).catch(async (e) => {
      this.aiServiceLogger.error(e);
      throw e;
    });
  }

  public formatHistory(history: MessageWithName[]): string {
    return history
      .map((x) => {
        return `${x.name}: ${x.message}`;
      })
      .join('\n');
  }

  public async promptWithHistory(request: SlashCommandRequest): Promise<void> {
    const { user_id, team_id, text: prompt } = request;
    await this.redis.setInflight(user_id, team_id);
    await this.redis.setDailyRequests(user_id, team_id);
    const history: MessageWithName[] = await this.historyService.getHistory(request, true);
    const formattedHistory: string = this.formatHistory(history);
    return this.openAiService
      .generateText(prompt, user_id, getHistoryInstructions(formattedHistory))
      .then(async (result) => {
        await this.redis.removeInflight(user_id, team_id);
        if (!result) {
          this.aiServiceLogger.warn(`No result returned for prompt: ${prompt}`);
          return;
        }

        const blocks: KnownBlock[] = [];

        const chunks = getChunks(result);

        if (chunks) {
          chunks.forEach((chunk) => {
            blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `${chunk}`,
              },
            });
          });
        }

        blocks.push({
          type: 'divider',
        });

        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `:technologist: _Context-aware prompt generated by <@${request.user_id}> | "${request.text}"_ :technologist:`,
            },
          ],
        });

        this.webService.sendMessage(request.channel_id, request.text, blocks).catch((e) => {
          this.aiServiceLogger.error(e);
          this.webService.sendMessage(
            request.user_id,
            'Sorry, unable to send the requested text to Slack. You have been credited for your Moon Token. Perhaps you were trying to send in a private channel? If so, invite @MoonBeam and try again.',
          );
        });
      })
      .catch(async (e) => {
        this.aiServiceLogger.error(e);
        await this.redis.removeInflight(user_id, team_id);
        await this.redis.decrementDailyRequests(user_id, team_id);
        throw e;
      });
  }

  public async participate(teamId: string, channelId: string, taggedMessage: string): Promise<void> {
    await this.redis.setParticipationInFlight(channelId, teamId);

    const messages = await this.historyService
      .getHistory({ team_id: teamId, channel_id: channelId } as SlashCommandRequest, false)
      .then((x) => this.formatHistory(x));
    const instructions = GET_TAGGED_MESSAGE_INSTRUCTIONS(taggedMessage);
    return this.openAiService
      .generateText(messages, 'Moonbeam', instructions)
      .then((result) => {
        if (result) {
          this.webService
            .sendMessage(channelId, result)
            .then(() => this.redis.setHasParticipated(teamId, channelId))
            .catch((e) => this.aiServiceLogger.error('Error sending AI Participation message:', e));
        }
      })
      .catch(async (e) => {
        this.aiServiceLogger.error(e);
        throw e;
      })
      .finally(() => {
        this.redis.removeParticipationInFlight(channelId, teamId);
      });
  }

  sendImage(image: string | undefined, userId: string, teamId: string, channel: string, text: string): void {
    if (image) {
      const blocks: KnownBlock[] = [
        {
          type: 'image',
          image_url: image,
          alt_text: text,
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `:camera_with_flash: _Generated by <@${userId}> | "${text}"_ :camera_with_flash:`,
            },
          ],
        },
      ];
      this.webService.sendMessage(channel, text, blocks).catch((e) => {
        this.aiServiceLogger.error(e);
        this.decrementDaiyRequests(userId, teamId);
        this.webService.sendMessage(
          userId,
          'Sorry, unable to send the requested image to Slack. You have been credited for your Moon Token. Perhaps you were trying to send in a private channel? If so, invite @MoonBeam and try again.',
        );
      });
    }
  }

  sendGptText(text: string | undefined, userId: string, teamId: string, channelId: string, query: string): void {
    if (text) {
      const blocks: KnownBlock[] = [];

      const chunks = getChunks(text);

      if (chunks) {
        chunks.forEach((chunk) => {
          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${chunk}`,
            },
          });
        });
      }

      blocks.push({
        type: 'divider',
      });

      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `:altman: _Generated by <@${userId}> | "${query}"_ :altman:`,
          },
        ],
      });

      this.webService.sendMessage(channelId, text, blocks).catch((e) => {
        this.aiServiceLogger.error(e);
        this.decrementDaiyRequests(userId, teamId);
        this.webService.sendMessage(
          userId,
          'Sorry, unable to send the requested text to Slack. You have been credited for your Moon Token. Perhaps you were trying to send in a private channel? If so, invite @MoonBeam and try again.',
        );
      });
    }
  }

  async handle(request: EventRequest): Promise<void> {
    const isUserMuzzled = await this.muzzlePersistenceService.isUserMuzzled(request.event.user, request.team_id);
    const isJudka = request.event.user === 'U2ZV8E68N';
    if (this.slackService.containsTag(request.event.text) && !isUserMuzzled && !isJudka) {
      const userId = this.slackService.getUserId(request.event.text);
      const isMoonbeamTagged = userId && userId.includes('ULG8SJRFF');
      const isPosterMoonbeam = request.event.user === 'ULG8SJRFF';
      if (isMoonbeamTagged && !isPosterMoonbeam) {
        this.participate(request.team_id, request.event.channel, request.event.text);
      }
    }
  }
}
