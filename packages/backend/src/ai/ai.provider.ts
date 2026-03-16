export interface AIProvider {
  generateText(input: string, userId: string, instructions?: string): Promise<string | undefined>;
  generateImage?(prompt: string, userId: string): Promise<string | undefined>;
}
