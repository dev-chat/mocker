import { Configuration, OpenAIApi } from 'openai';

export class AIService {
  inflightRequests: string[] = [];
  private openai = new OpenAIApi(
    new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    }),
  );

  public isAlreadyInflight(user: string): boolean {
    return this.inflightRequests.includes(user);
  }

  public generateText(user: string, text: string): Promise<string | undefined> {
    this.inflightRequests.push(user);
    return this.openai
      .createCompletion({
        model: 'text-davinci-003',
        prompt: text,
        // eslint-disable-next-line @typescript-eslint/camelcase
        max_tokens: 1000,
      })
      .then(x => {
        this.inflightRequests = this.inflightRequests.filter(x => x != user);
        console.log(x.data);
        return x.data.choices[0].text?.trim();
      });
  }

  public generateImage(user: string, text: string): Promise<string | undefined> {
    this.inflightRequests.push(user);
    return this.openai
      .createImage({
        prompt: text,
        n: 1,
        size: '1024x1024',
      })
      .then(x => {
        this.inflightRequests = this.inflightRequests.filter(x => x != user);
        console.log(x.data.data);
        return x.data.data[0]?.url;
      });
  }
}
