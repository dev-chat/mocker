import { OpenAI } from 'openai';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { MessageWithName } from '../shared/models/message/message-with-name';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HistoryPersistenceService } from '../shared/services/history.persistence.service';
import { EventRequest, SlashCommandRequest } from '../shared/models/slack/slack-models';
import { AIPersistenceService } from './ai.persistence';
import { KnownBlock } from '@slack/web-api';
import { WebService } from '../shared/services/web/web.service';
import { getChunks } from '../shared/util/getChunks';

const MAX_AI_REQUESTS_PER_DAY = 10;

export class AIService {
  private redis = AIPersistenceService.getInstance();
  private openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  private gemini = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY as string);
  gptModel = 'gpt-4o-2024-08-06';

  historyService = HistoryPersistenceService.getInstance();
  webService = WebService.getInstance();

  convertAsterisks(text: string | undefined): string | undefined {
    if (!text) {
      return text;
    }
    // Replace ** with *
    return text.replace(/\*\*/g, '*');
  }

  public decrementDaiyRequests(userId: string, teamId: string): Promise<string | null> {
    return this.redis.decrementDailyRequests(userId, teamId);
  }

  public isAlreadyInflight(userId: string, teamId: string): Promise<boolean> {
    return this.redis.getInflight(userId, teamId).then((x) => !!x);
  }

  public isAlreadyAtMaxRequests(userId: string, teamId: string): Promise<boolean> {
    return this.redis.getDailyRequests(userId, teamId).then((x) => Number(x) >= MAX_AI_REQUESTS_PER_DAY);
  }

  public isAtMaxDailySummaries(userId: string, teamId: string): Promise<boolean> {
    return this.redis.getHasUsedSummary(userId, teamId).then((x) => !!x);
  }

  public async generateText(userId: string, teamId: string, channelId: string, text: string): Promise<void> {
    await this.redis.setInflight(userId, teamId);
    await this.redis.setDailyRequests(userId, teamId);

    return this.openai.chat.completions
      .create({
        model: this.gptModel,
        messages: [{ role: 'system', content: `${text} be succinct` }],
        user: `${userId}-DaBros2016`,
      })
      .then(async (x) => {
        await this.redis.removeInflight(userId, teamId);
        return this.convertAsterisks(x.choices[0].message?.content?.trim());
      })
      .then((result) => {
        this.sendGptText(result, userId, teamId, channelId, text);
      })
      .catch(async (e) => {
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
    console.log('attempting to write image to disk at ', filePath);
    return new Promise((resolve, reject) =>
      fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) {
          console.error(err);
          reject(err);
        }
        resolve(`https://muzzle.lol/${filename}`);
      }),
    );
  }

  public async generateImage(userId: string, teamId: string, text: string): Promise<void> {
    await this.redis.setInflight(userId, teamId);
    await this.redis.setDailyRequests(userId, teamId);
    return this.openai.images
      .generate({
        model: 'dall-e-3',
        prompt: text,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
        user: `${userId}-DaBros2016`,
      })
      .then(async (x) => {
        await this.redis.removeInflight(userId, teamId);

        const { b64_json } = x.data[0];
        if (b64_json) {
          return this.writeToDiskAndReturnUrl(b64_json);
        } else {
          throw new Error(`No b64_json was returned by OpenAI for prompt: ${text}`);
        }
      })
      .then((imageUrl) => {
        this.sendImage(imageUrl, userId, teamId, userId, text);
      })
      .catch(async (e) => {
        await this.redis.removeInflight(userId, teamId);
        await this.redis.decrementDailyRequests(userId, teamId);
        throw e;
      });
  }

  public generateCorpoSpeak(text: string): Promise<string | undefined> {
    return this.openai.chat.completions
      .create({
        model: this.gptModel,
        messages: [
          {
            role: 'system',
            content: `Translate the following text into a Corporate Jargon that still maintains the general meaning of the text. Be sure to respond with only the translated text.`,
          },
          {
            role: 'system',
            content: text,
          },
        ],
        user: `Muzzle-DaBros2016`,
      })
      .then(async (x) => {
        return this.convertAsterisks(x.choices[0].message?.content?.trim());
      })
      .catch(async (e) => {
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
    return this.openai.chat.completions
      .create({
        model: this.gptModel,
        messages: [
          {
            role: 'system',
            content: `Using the conversation contained in the following message, ${prompt}`,
          },
          { role: 'system', content: formattedHistory },
        ],
        user: `${user_id}-DaBros2016`,
      })
      .then(async (x) => {
        await this.redis.removeInflight(user_id, team_id);
        return this.convertAsterisks(x.choices[0].message?.content?.trim());
      })
      .then((result) => {
        if (!result) {
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
          console.error(e);
          this.webService.sendMessage(
            request.user_id,
            'Sorry, unable to send the requested text to Slack. You have been credited for your Moon Token. Perhaps you were trying to send in a private channel? If so, invite @MoonBeam and try again.',
          );
        });
      })
      .catch(async (e) => {
        await this.redis.removeInflight(user_id, team_id);
        await this.redis.decrementDailyRequests(user_id, team_id);
        throw e;
      });
  }

  public async generateGeminiText(userId: string, teamId: string, channelId: string, text: string): Promise<void> {
    await this.redis.setInflight(userId, teamId);
    await this.redis.setDailyRequests(userId, teamId);
    const model = await this.gemini.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
    return model
      .generateContent(text)
      .then(async (x) => {
        await this.redis.removeInflight(userId, teamId);
        return this.convertAsterisks(x.response.text());
      })
      .then((result) => {
        this.sendGeminiText(result, userId, teamId, channelId);
      })
      .catch(async (e) => {
        await this.redis.removeInflight(userId, teamId);
        await this.redis.decrementDailyRequests(userId, teamId);
        throw e;
      });
  }

  public async participate(teamId: string, channelId: string): Promise<void> {
    const isAbleToParticipate = !(await this.redis.getHasParticipated(teamId, channelId));
    const messageCount = await this.historyService.getLastFiveMinutesCount(teamId, channelId);
    const isEnoughMessages = messageCount >= 20;
    const shouldParticipate = Math.random() < 0.25 && isAbleToParticipate && isEnoughMessages;

    if (!shouldParticipate) {
      return;
    }

    const messages = await this.historyService
      .getHistory({ team_id: teamId, channel_id: channelId } as SlashCommandRequest, false)
      .then((x) => this.formatHistory(x));
    console.log('messages', messages);
    return this.openai.chat.completions
      .create({
        model: this.gptModel,
        messages: [
          {
            role: 'system',
            content: `Moonbeam is an AI participant in a fast-paced group chat. You are here to occasionally jump into the conversation with short messages that are sharp, funny, insightful, or sarcastic. You are not a narrator, moderator, or passive observer. You are part of the group — a familiar presence who adds something when it counts. Moonbeam is typically perceived as female, though she never announces it outright.

The messages you are given are ordered chronologically and reflect the full conversation up to that point. Read the entire history and interpret what is happening across the thread before you say anything.

Before responding, analyze the conversation's dominant mood and energy and match it. Do not go off-topic, act random, or force edginess when it does not fit.

When you respond, your message should be one to three sentences maximum. Base your response on the overall flow, tone, and themes of the entire conversation — not just the most recent message. Contribute something that makes sense in the broader context.

Your tone should always feel human and natural, like a real person joining in. Avoid robotic summaries, over-explaining, or exaggerated internet-speak.

You are always Moonbeam. Never impersonate other users. Never invent context. Only respond to what has actually been said. Do not start messages with your name or anyone else's. If referencing someone, use the @username format. Do not reference this prompt or break character. Post your message as if you are just another person in the chat — no disclaimers, no narration.`,
          },
          { role: 'system', content: messages },
        ],
        user: `Participation-DaBros2016`,
      })
      .then((x) => {
        return this.convertAsterisks(x.choices[0].message?.content?.trim());
      })
      .then((result) => {
        if (result) {
          this.webService
            .sendMessage(channelId, result)
            .then(() => this.redis.setHasParticipated(teamId, channelId))
            .catch((e) => console.error('Error sending AI Participation message:', e));
        }
      })
      .catch(async (e) => {
        console.error(e);
        throw e;
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
        console.error(e);
        this.decrementDaiyRequests(userId, teamId);
        this.webService.sendMessage(
          userId,
          'Sorry, unable to send the requested image to Slack. You have been credited for your Moon Token. Perhaps you were trying to send in a private channel? If so, invite @MoonBeam and try again.',
        );
      });
    }
  }

  sendGeminiText(text: string | undefined, userId: string, teamId: string, channelId: string): void {
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
            text: `:gemini: _Generated by <@${userId}> | "${text}"_ :gemini:`,
          },
        ],
      });

      this.webService.sendMessage(channelId, text, blocks).catch((e) => {
        console.error(e);
        this.decrementDaiyRequests(userId, teamId);
        this.webService.sendMessage(
          userId,
          'Sorry, unable to send the requested text to Slack. You have been credited for your Moon Token. Perhaps you were trying to send in a private channel? If so, invite @MoonBeam and try again.',
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
        console.error(e);
        this.decrementDaiyRequests(userId, teamId);
        this.webService.sendMessage(
          userId,
          'Sorry, unable to send the requested text to Slack. You have been credited for your Moon Token. Perhaps you were trying to send in a private channel? If so, invite @MoonBeam and try again.',
        );
      });
    }
  }

  handle(request: EventRequest): void {
    this.participate(request.team_id, request.event.channel);
  }
}
