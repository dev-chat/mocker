import { OpenAI } from 'openai';
import { AIPersistenceService } from './ai.persistence';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { MessageWithName } from '../../shared/models/message/message-with-name';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HistoryPersistenceService } from '../history/history.persistence.service';
import { SlashCommandRequest } from '../../shared/models/slack/slack-models';

const MAX_AI_REQUESTS_PER_DAY = 10;

export class AIService {
  private redis = AIPersistenceService.getInstance();
  private openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  private gemini = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY as string);
  gptModel = 'gpt-4o-2024-08-06';

  historyService = HistoryPersistenceService.getInstance();

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

  public async generateText(userId: string, teamId: string, text: string): Promise<string | undefined> {
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

  public async generateImage(userId: string, teamId: string, text: string): Promise<string> {
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

  public async getSummary(
    userId: string,
    teamId: string,
    history: string,
    isDaily: boolean,
  ): Promise<string | undefined> {
    await this.redis.setInflight(userId, teamId);
    await this.redis.setDailyRequests(userId, teamId);
    const prompt = `please give ${isDaily ? 'a summary' : 'a one sentence summary'} of the following conversation, followed by a three verbatims from the participants that are particularly funny or interesting ensuring that the verbatims are from different people.`;
    return this.openai.chat.completions
      .create({
        model: this.gptModel,
        messages: [
          {
            role: 'system',
            content: prompt,
          },
          { role: 'system', content: history },
        ],
        user: `${userId}-DaBros2016`,
      })
      .then(async (x) => {
        await this.redis.removeInflight(userId, teamId);
        if (isDaily) {
          await this.redis.setHasUsedSummary(userId, teamId);
        }
        return this.convertAsterisks(x.choices[0].message?.content?.trim());
      })
      .catch(async (e) => {
        if (isDaily) {
          await this.redis.removeHasUsedSummary(userId, teamId);
        }
        await this.redis.removeInflight(userId, teamId);
        await this.redis.decrementDailyRequests(userId, teamId);
        throw e;
      });
  }

  public async promptWithHistory(
    userId: string,
    teamId: string,
    history: string,
    prompt: string,
  ): Promise<string | undefined> {
    await this.redis.setInflight(userId, teamId);
    await this.redis.setDailyRequests(userId, teamId);
    return this.openai.chat.completions
      .create({
        model: this.gptModel,
        messages: [
          {
            role: 'system',
            content: `Using the conversation contained in the following message, ${prompt}`,
          },
          { role: 'system', content: history },
        ],
        user: `${userId}-DaBros2016`,
      })
      .then(async (x) => {
        await this.redis.removeInflight(userId, teamId);
        return this.convertAsterisks(x.choices[0].message?.content?.trim());
      })
      .catch(async (e) => {
        await this.redis.removeInflight(userId, teamId);
        await this.redis.decrementDailyRequests(userId, teamId);
        throw e;
      });
  }

  public async generateGeminiText(userId: string, teamId: string, text: string): Promise<string | undefined> {
    await this.redis.setInflight(userId, teamId);
    await this.redis.setDailyRequests(userId, teamId);
    const model = await this.gemini.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
    return model
      .generateContent(text)
      .then(async (x) => {
        await this.redis.removeInflight(userId, teamId);
        return this.convertAsterisks(x.response.text());
      })
      .catch(async (e) => {
        await this.redis.removeInflight(userId, teamId);
        await this.redis.decrementDailyRequests(userId, teamId);
        throw e;
      });
  }

  public async participate(teamId: string, channelId: string): Promise<string | undefined> {
    const count = await this.historyService.getLastFiveMinutesCount(teamId, channelId);

    if (count < 20) {
      return; // Not enough messages to participate
    }

    const messages = await this.historyService
      .getHistory({ team_id: teamId, channel_id: channelId } as SlashCommandRequest, false)
      .then((x) => this.formatHistory(x));
    console.log(messages);
    return this.openai.chat.completions
      .create({
        model: this.gptModel,
        messages: [
          {
            role: 'system',
            content: `Using the conversation contained in the following message, please participate in the conversation with a message of your own. 
            Be sure to respond in a way that fits the tone of the conversation. 
            Ensure that your response is only 1-3 sentences long at maximum.
            Keep in mind that messages are ordered chronologically, so your response should be relevant to the most recent message in the conversation.
            Participants in the chat will refer to you as Moonbeam. 
            Do not preface any messages with your name or someone else's name.
            Do not include any other context or information in your response, just the message itself.
            If you would like to address a specific user in the conversation, please do so be prefacing their name with an @ symbol.`,
          },
          { role: 'system', content: messages },
        ],
        user: `Participation-DaBros2016`,
      })
      .then((x) => this.convertAsterisks(x.choices[0].message?.content?.trim()))
      .catch(async (e) => {
        console.error(e);
        throw e;
      });
  }
}
