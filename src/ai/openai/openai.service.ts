import OpenAI from 'openai';
import { GPT_IMAGE_MODEL, GPT_MODEL } from '../ai.constants';
import {
  ResponseOutputMessage,
  ResponseOutputItem,
  ResponseOutputText,
  ResponseOutputRefusal,
} from 'openai/resources/responses/responses';

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
        const textBlock: ResponseOutputMessage | undefined = x.output.find(
          (block: ResponseOutputItem) => block.type === 'message',
        ) as ResponseOutputMessage;
        const outputText = (
          textBlock?.content?.find(
            (block: ResponseOutputText | ResponseOutputRefusal) => block.type === 'output_text',
          ) as ResponseOutputText
        )?.text;
        return this.markdownToSlackMrkdwn(outputText?.trim());
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

  markdownToSlackMrkdwn = (text?: string) => {
    if (!text) {
      return text;
    }
    // Convert **bold** to *bold*
    text = text.replace(/\*\*/g, '*');
    // Convert *italic* to _italic_
    text = text?.replace(/\*(.*?)\*/g, '_$1_');
    // Convert `code` to `code`
    text = text?.replace(/`(.*?)`/g, '`$1`');
    // Convert [link](url) to <url|link>
    text = text?.replace(/\[(.*?)\]\((.*?)\)/g, '<$2|$1>');
    // Convert ![alt text](image url) to <image url|alt text>
    text = text?.replace(/!\[(.*?)\]\((.*?)\)/g, '<$2|$1>');

    return text;
  };
}
