import { AIProvider } from '../ai.provider';
import { OpenAIService } from './openai.service';

export class OpenAIProvider implements AIProvider {
  private service: OpenAIService;

  constructor(service?: OpenAIService) {
    this.service = service || new OpenAIService();
  }

  generateText(input: string, userId: string, instructions?: string): Promise<string | undefined> {
    return this.service.generateText(input, userId, instructions);
  }

  generateImage(prompt: string, userId: string): Promise<string | undefined> {
    return this.service.generateImage(prompt, userId);
  }
}
