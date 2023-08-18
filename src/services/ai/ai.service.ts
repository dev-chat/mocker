import { Configuration, OpenAIApi } from 'openai';
import { AIPersistenceService } from './ai.persistence';

const MAX_AI_REQUESTS_PER_DAY = 10;

export class AIService {
  private redis = AIPersistenceService.getInstance();
  private openai = new OpenAIApi(
    new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    }),
  );

  public decrementDaiyRequests(userId: string, teamId: string): Promise<string | null> {
    return this.redis.decrementDailyRequests(userId, teamId);
  }

  public isAlreadyInflight(userId: string, teamId: string): Promise<boolean> {
    return this.redis.getInflight(userId, teamId).then(x => !!x);
  }

  public isAlreadyAtMaxRequests(userId: string, teamId: string): Promise<boolean> {
    return this.redis.getDailyRequests(userId, teamId).then(x => Number(x) >= MAX_AI_REQUESTS_PER_DAY);
  }

  public async generateText(userId: string, teamId: string, text: string): Promise<string | undefined> {
    await this.redis.setInflight(userId, teamId);
    await this.redis.setDailyRequests(userId, teamId);

    return this.openai
      .createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: text }],
        // eslint-disable-next-line @typescript-eslint/camelcase
        max_tokens: 1000,
        user: `${userId}-DaBros2016`,
      })
      .then(async x => {
        await this.redis.removeInflight(userId, teamId);
        return x.data.choices[0].message?.content?.trim();
      })
      .catch(async e => {
        await this.redis.removeInflight(userId, teamId);
        await this.redis.decrementDailyRequests(userId, teamId);
        throw e;
      });
  }

  public async generateImage(userId: string, teamId: string, text: string): Promise<string> {
    await this.redis.setInflight(userId, teamId);
    await this.redis.setDailyRequests(userId, teamId);
    return this.openai
      .createImage({
        prompt: text,
        n: 1,
        size: '256x256',
        // eslint-disable-next-line @typescript-eslint/camelcase
        response_format: 'b64_json',
        user: `${userId}-DaBros2016`,
      })
      .then(async x => {
        await this.redis.removeInflight(userId, teamId);

        // eslint-disable-next-line @typescript-eslint/camelcase
        const { b64_json } = x.data.data[0];
        // eslint-disable-next-line @typescript-eslint/camelcase
        if (b64_json) {
          // eslint-disable-next-line @typescript-eslint/camelcase
          return b64_json;
        } else {
          throw new Error(`No b64_json was returned by OpenAI for prompt: ${text}`);
        }
      })
      .catch(async e => {
        await this.redis.removeInflight(userId, teamId);
        await this.redis.decrementDailyRequests(userId, teamId);
        throw e;
      });
  }
}
