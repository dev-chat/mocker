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
        // Arbitrary 2 removes the first two /n characters in the response.
        return x.data.choices[0].text;
      });
  }
}
