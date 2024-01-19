import { OpenAI } from 'openai';
import { AIPersistenceService } from './ai.persistence';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { MessageWithName } from '../../shared/models/message/message-with-name';

const MAX_AI_REQUESTS_PER_DAY = 10;

export class AIService {
  private redis = AIPersistenceService.getInstance();
  private openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  public decrementDaiyRequests(userId: string, teamId: string): Promise<string | null> {
    return this.redis.decrementDailyRequests(userId, teamId);
  }

  public isAlreadyInflight(userId: string, teamId: string): Promise<boolean> {
    return this.redis.getInflight(userId, teamId).then((x) => !!x);
  }

  public isAlreadyAtMaxRequests(userId: string, teamId: string): Promise<boolean> {
    return this.redis.getDailyRequests(userId, teamId).then((x) => Number(x) >= MAX_AI_REQUESTS_PER_DAY);
  }

  public async generateText(userId: string, teamId: string, text: string): Promise<string | undefined> {
    await this.redis.setInflight(userId, teamId);
    await this.redis.setDailyRequests(userId, teamId);

    return this.openai.chat.completions
      .create({
        model: 'gpt-4',
        messages: [{ role: 'system', content: text }],
        max_tokens: 1000,
        user: `${userId}-DaBros2016`,
      })
      .then(async (x) => {
        await this.redis.removeInflight(userId, teamId);
        return x.choices[0].message?.content?.trim();
      })
      .catch(async (e) => {
        await this.redis.removeInflight(userId, teamId);
        await this.redis.decrementDailyRequests(userId, teamId);
        throw e;
      });
  }

  public async writeToDiskAndReturnUrl(base64Image: string): Promise<string> {
    const dir = path.join(__dirname, '../../../images');
    const filename = `${uuidv4()}.png`;
    const filePath = path.join(dir, filename);
    const base64Data = base64Image.replace(/^data:image\/png;base64,/, '');

    return new Promise((resolve, reject) =>
      fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) reject(err);
        resolve(`http://muzzle.lol:8080/${filename}`);
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

  public formatHistory(history: MessageWithName[]): string {
    return history
      .map((x) => {
        return `${x.name}: ${x.message}`;
      })
      .join('\n');
  }

  public async getSummary(userId: string, teamId: string, history: string): Promise<string | undefined> {
    await this.redis.setInflight(userId, teamId);
    await this.redis.setDailyRequests(userId, teamId);
    return this.openai.chat.completions
      .create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content:
              'please give 3 bullet points summarizing the conversation that occurred in the following messages. in addition to the summary, please share any humourous or interesting messages from the conversation. Be sure to include the direct quote and authors name.',
          },
          { role: 'system', content: history },
        ],
        user: `${userId}-DaBros2016`,
      })
      .then(async (x) => {
        await this.redis.removeInflight(userId, teamId);
        return x.choices[0].message?.content?.trim();
      })
      .catch(async (e) => {
        await this.redis.removeInflight(userId, teamId);
        await this.redis.decrementDailyRequests(userId, teamId);
        throw e;
      });
  }
}
