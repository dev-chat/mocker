import { GoogleGenAI, HarmBlockMethod, HarmBlockThreshold, HarmCategory } from '@google/genai';

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

  generateImage(prompt: string): Promise<string> {
    const safetySettings = Object.values(HarmCategory).map((category) => ({
      category,
      threshold: HarmBlockThreshold.OFF,
      method: HarmBlockMethod.SEVERITY,
    }));

    return this.client.models
      .generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: prompt,
        config: {
          candidateCount: 1,
          responseModalities: ['IMAGE'],
          imageConfig: {
            imageSize: '1024x1024',
          },
          safetySettings,
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
