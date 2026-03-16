import { GoogleGenAI } from '@google/genai';

export class GeminiService {
  client = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

  generateText(prompt: string, systemInstruction?: string): Promise<string | undefined> {
    return this.client.models
      .generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{ text: prompt }],
        config: {
          systemInstruction,
          candidateCount: 1,
          responseModalities: ['TEXT'],
        },
      })
      .then((response) => response.text);
  }

  generateImage(prompt: string): Promise<string> {
    return this.client.models
      .generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: prompt,
        config: {
          candidateCount: 1,
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: '16:9',
            imageSize: '1K',
          },
        },
      })
      .then((response) => {
        let imageBytes = Buffer.from([]);
        response.candidates?.[0].content?.parts?.forEach((part) => {
          if (part?.inlineData?.data) {
            imageBytes = Buffer.concat([imageBytes, Buffer.from(part?.inlineData?.data, 'base64')]);
          }
        });

        return imageBytes.toString('base64');
      });
  }
}
