import { GoogleGenAI, PersonGeneration, SafetyFilterLevel } from '@google/genai';

export class GeminiService {
  client = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

  generateText(prompt: string) {
    return this.client.models
      .generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{ text: prompt }],
      })
      .then((response) => response.text);
  }

  generateImage(prompt: string) {
    return this.client.models
      .generateImages({
        model: 'gemini-3-pro-image-preview',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          imageSize: '1024x1024',
          safetyFilterLevel: SafetyFilterLevel.BLOCK_NONE,
          personGeneration: PersonGeneration.ALLOW_ALL,
        },
      })
      .then((response) => response.generatedImages?.[0].image?.imageBytes);
  }
}
