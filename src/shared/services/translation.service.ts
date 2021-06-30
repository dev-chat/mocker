import Axios, { AxiosResponse } from 'axios';

export class TranslationService {
  private supportedLanguages = ['zh-TW', 'en', 'eo', 'de', 'haw', 'ga', 'it', 'ja', 'la', 'ru', 'es', 'th', 'fr', 'he'];
  public translate(text: string): Promise<string> {
    return Axios.post(
      `https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`,
      {
        q: text,
        source: 'en',
        target: this.getRandomLanguage(),
        format: 'text',
      },
    ).then((res: AxiosResponse) => {
      console.log(res?.data?.data?.translations?.[0].translatedText);
      return res?.data?.data?.translations?.[0].translatedText;
    });
  }

  getRandomLanguage(): string {
    return this.supportedLanguages[Math.floor(Math.random() * this.supportedLanguages.length)];
  }
}
