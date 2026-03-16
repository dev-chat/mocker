import { AIProvider } from '../ai.provider';
import { GeminiService } from './gemini.service';

export class GeminiProvider implements AIProvider {
  private service: GeminiService;

  constructor(service?: GeminiService) {
    this.service = service || new GeminiService();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  generateText(input: string, _userId: string, instructions?: string): Promise<string | undefined> {
    return this.service.generateText(input, instructions);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  generateImage(prompt: string, _userId: string): Promise<string | undefined> {
    return this.service.generateImage(prompt);
  }
}
