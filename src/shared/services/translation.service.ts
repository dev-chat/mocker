import Axios, { AxiosResponse } from 'axios';

export class TranslationService {
  private supportedLanguages = ['de', 'es'];
  public translate(text: string): Promise<string> {
    const lang = this.getRandomLanguage();
    if (lang !== 'en') {
      return Axios.post(
        `https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`,
        {
          q: text,
          source: 'en',
          target: lang,
          format: 'text',
        },
      ).then((res: AxiosResponse) => {
        console.log(res?.data?.data?.translations?.[0].translatedText);
        return res?.data?.data?.translations?.[0].translatedText;
      });
    }
    return new Promise((resolve, _reject) => resolve(text));
  }

  getRandomLanguage(): string {
    return this.supportedLanguages[Math.floor(Math.random() * this.supportedLanguages.length)];
  }
}
