import { Configuration, OpenAIApi } from 'openai';
<<<<<<< HEAD
import { AIPersistenceService } from './ai.persistence';

const MAX_AI_REQUESTS_PER_DAY = 7;
=======
import { uuid } from 'uuidv4';
>>>>>>> 007881d (Added buffer logic)

export class AIService {
  private redis = AIPersistenceService.getInstance();
  private openai = new OpenAIApi(
    new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    }),
  );

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
      .createCompletion({
        model: 'text-davinci-003',
        prompt: text,
        // eslint-disable-next-line @typescript-eslint/camelcase
        max_tokens: 1000,
      })
      .then(x => {
        console.log(x.data);
        return x.data.choices[0].text?.trim();
      })
      .catch(async e => {
        await this.redis.decrementDailyRequests(userId, teamId);
        throw e;
      })
      .finally(() => this.redis.removeInflight(userId, teamId));
  }

<<<<<<< HEAD
  public async generateImage(userId: string, teamId: string, text: string): Promise<string | undefined> {
    await this.redis.setInflight(userId, teamId);
    await this.redis.setDailyRequests(userId, teamId);
=======
  public generateImage(user: string, text: string): Promise<Buffer | undefined> {
    this.inflightRequests.push(user);
>>>>>>> 007881d (Added buffer logic)
    return this.openai
      .createImage({
        prompt: text,
        n: 1,
        size: '256x256',
        // eslint-disable-next-line @typescript-eslint/camelcase
        response_format: 'b64_json',
      })
      .then(x => {
        console.log(x.data.data);
        if (x.data.data[0]?.b64_json) {
          return Buffer.from(`data:image/png;base64, ` + x.data.data[0]?.b64_json);
        }
        return;
      })
      .catch(async e => {
        await this.redis.decrementDailyRequests(userId, teamId);
        throw e;
      })
      .finally(async () => await this.redis.removeInflight(userId, teamId));
  }
}
