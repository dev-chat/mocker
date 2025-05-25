import OpenAI from 'openai';
import { GPT_IMAGE_MODEL, GPT_MODEL } from '../ai.constants';

export class OpenAIService {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  generateText = (text: string, userId: string, instructions?: string) => {
    return this.openai.responses
      .create({
        model: GPT_MODEL,
        tools: [{ type: 'web_search_preview' }],
        instructions: instructions,
        input: text,
        user: `${userId}-DaBros2016`,
      })
      .then((x) => {
        const textBlock = x.output.find((block) => block.type === 'message');
        const outputText = textBlock?.content?.find((block) => block.type === 'output_text')?.text;
        return this.convertAsterisks(outputText?.trim());
      });
  };

  generateImage = (text: string, userId: string) => {
    return this.openai.images
      .generate({
        model: GPT_IMAGE_MODEL,
        prompt: text,
        user: `${userId}-DaBros2016`,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      })
      .then((x) => {
        return x?.data?.[0].b64_json;
      });
  };

  convertAsterisks = (text?: string) => {
    if (!text) {
      return text;
    }
    // Replace ** with *
    return text.replace(/\*\*/g, '*');
  };
}
