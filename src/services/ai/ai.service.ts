import { Configuration, OpenAIApi } from 'openai';

export class AIService {
  private openai = new OpenAIApi(
    new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    }),
  );
  public generateText(text: string): Promise<string | undefined> {
    return this.openai
      .createCompletion({
        model: 'text-davinci-003',
        prompt: text,
        // eslint-disable-next-line @typescript-eslint/camelcase
        max_tokens: 1000,
      })
      .then(x => {
        console.log(x.data);
        return x.data.choices[0].text;
      });
  }
}
