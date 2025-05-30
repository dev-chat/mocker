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
        return x?.data?.[0]?.b64_json;
      });
  };

  markdownToSlackMrkdwn = (text?: string) => {
    if (!text) {
      return text;
    }

    // Convert ![alt text](image url) to <image url|alt text> (do this first to avoid conflicts with links)
    text = text.replace(/!\[(.*?)\]\((.*?)\)/g, '<$2|$1>');

    // Convert [link](url) to <url|link>
    text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<$2|$1>');

    // Convert `code` to `code` (no change needed, but process before bold/italic to avoid conflicts)
    text = text.replace(/`(.*?)`/g, '`$1`');

    // Use a more robust approach for bold and italic
    // First, temporarily replace **bold** with a placeholder to avoid conflicts
    const boldPlaceholder = 'BOLD_PLACEHOLDER';
    const boldMatches: string[] = [];

    // Extract bold text and replace with placeholders, but first process italic within bold
    text = text.replace(/\*\*(.*?)\*\*/g, (match, content) => {
      // Process italic formatting within the bold content
      const processedContent = content.replace(/\*([^*]+?)\*/g, '_$1_');
      boldMatches.push(processedContent);
      return `${boldPlaceholder}${boldMatches.length - 1}${boldPlaceholder}`;
    });

    // Now convert remaining single asterisks to italic (underscores)
    text = text.replace(/\*([^*]+?)\*/g, '_$1_');

    // Restore bold text with Slack formatting
    text = text.replace(new RegExp(`${boldPlaceholder}(\\d+)${boldPlaceholder}`, 'g'), (match, index) => {
      return `*${boldMatches[parseInt(index)]}*`;
    });

    return text;
  };
}
