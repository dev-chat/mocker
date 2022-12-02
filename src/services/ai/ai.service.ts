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
        model: 'text-davinci-002',
        prompt: text,
        temperature: 0.6,
      })
      .then(x => {
        console.log(x.data);
        return x.data.choices[0].text;
      });
  }
}
