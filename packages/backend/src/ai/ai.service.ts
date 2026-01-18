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
  MOONBEAM_SYSTEM_INSTRUCTIONS,
  getHistoryInstructions,
  MAX_AI_REQUESTS_PER_DAY,
  REDPLOY_MOONBEAM_IMAGE_PROMPT,
  REDPLOY_MOONBEAM_TEXT_PROMPT,
} from './ai.constants';
import { logger } from '../shared/logger/logger';
import { SlackService } from '../shared/services/slack/slack.service';
import { MuzzlePersistenceService } from '../muzzle/muzzle.persistence.service';
import { OpenAIService } from './openai/openai.service';
import { GeminiService } from './gemini/gemini.service';

export class AIService {
  redis = new AIPersistenceService();
  openAiService = new OpenAIService();
  geminiService = new GeminiService();

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

  public async generateText(
    userId: string,
    teamId: string,
    channelId: string,
    text: string,
    isGemini = false,
  ): Promise<void> {
    await this.redis.setInflight(userId, teamId);
    await this.redis.setDailyRequests(userId, teamId);
    const textPromise = isGemini
      ? this.geminiService.generateText(text, GENERAL_TEXT_INSTRUCTIONS)
      : this.openAiService.generateText(text, userId, GENERAL_TEXT_INSTRUCTIONS);
    return textPromise
      .then(async (result) => {
        await this.redis.removeInflight(userId, teamId);
        if (result) {
          this.sendGptText(result, userId, teamId, channelId, text);
        } else {
          this.aiServiceLogger.warn(`No result returned for prompt: ${text}`);
          throw new Error(`No result returned for prompt: ${text}`);
        }
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
    const aiQuote = this.openAiService.generateText(REDPLOY_MOONBEAM_TEXT_PROMPT, 'Moonbeam').catch((e) => {
      this.aiServiceLogger.error(e);
    });

    const aiImage = this.geminiService.generateImage(REDPLOY_MOONBEAM_IMAGE_PROMPT).then(async (x) => {
      if (x) {
        return this.writeToDiskAndReturnUrl(x);
      } else {
        this.aiServiceLogger.error(`No b64_json was returned by OpenAI for prompt: ${REDPLOY_MOONBEAM_IMAGE_PROMPT}`);
        throw new Error(`No b64_json was returned by OpenAI for prompt: ${REDPLOY_MOONBEAM_IMAGE_PROMPT}`);
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

  public async generateImage(
    userId: string,
    teamId: string,
    channel: string,
    text: string,
    isGemini = true,
  ): Promise<void> {
    await this.redis.setInflight(userId, teamId);
    await this.redis.setDailyRequests(userId, teamId);
    const imagePromise = isGemini
      ? this.geminiService.generateImage(text)
      : this.openAiService.generateImage(text, userId);
    return imagePromise
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
    if (!history || history.length === 0) {
      return '[No recent messages in channel]';
    }

    return history
      .map((x) => {
        const timestamp = x.createdAt
          ? new Date(x.createdAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '';
        const prefix = timestamp ? `[${timestamp}] ` : '';
        return `${prefix}${x.name}: ${x.message}`;
      })
      .join('\n');
  }

  public async promptWithHistory(request: SlashCommandRequest, isGemini = false): Promise<void> {
    const { user_id, team_id, text: prompt } = request;
    await this.redis.setInflight(user_id, team_id);
    await this.redis.setDailyRequests(user_id, team_id);
    const history: MessageWithName[] = await this.historyService.getHistory(request, true);
    const formattedHistory: string = this.formatHistory(history);
    const systemInstructions = getHistoryInstructions(formattedHistory);
    const textGenPromise = isGemini
      ? this.geminiService.generateText(prompt, systemInstructions)
      : this.openAiService.generateText(prompt, user_id, systemInstructions);
    return textGenPromise
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

    // Use getHistoryWithOptions to include Moonbeam's own messages and use larger context window
    const history = await this.historyService
      .getHistoryWithOptions({
        teamId,
        channelId,
        maxMessages: 200,
        timeWindowMinutes: 120,
        // No excludeUserId - include all messages including Moonbeam's for conversational continuity
      })
      .then((x) => this.formatHistory(x));

    // Append tagged message to history as user input (not in system instructions)
    // This prevents prompt injection and follows best practices
    const input = `${history}\n\n---\n[Tagged message to respond to]:\n${taggedMessage}`;

    return this.openAiService
      .generateText(input, 'Moonbeam', MOONBEAM_SYSTEM_INSTRUCTIONS)
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
    if (this.slackService.containsTag(request.event.text) && !isUserMuzzled) {
      // Check if Moonbeam is mentioned ANYWHERE in the message (not just first mention)
      const isMoonbeamTagged = this.slackService.isUserMentioned(request.event.text, 'ULG8SJRFF');
      const isPosterMoonbeam = request.event.user === 'ULG8SJRFF';
      if (isMoonbeamTagged && !isPosterMoonbeam) {
        this.participate(request.team_id, request.event.channel, request.event.text);
      }
    }
  }
}
