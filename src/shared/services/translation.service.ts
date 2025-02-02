import Axios, { AxiosResponse } from 'axios';

export class TranslationService {
  public translate(text: string): Promise<string> {
    const lang = this.getRandomLanguage();
    return Axios.post(
      encodeURI(`https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`),
      {
        q: text,
        source: 'en',
        target: lang,
        format: 'text',
      },
    ).then((res: AxiosResponse) => {
      return res?.data?.data?.translations?.[0].translatedText;
    });
  }

  private getRandomLanguage(): string {
    const roll = Math.random();
    if (roll >= 0.25) {
      return 'es';
    } else if (roll >= 0.23 && roll < 0.25) {
      return 'ru';
    } else if (roll >= 0.21 && roll < 0.23) {
      return 'fr';
    } else if (roll >= 0.19 && roll < 0.21) {
      return 'ja';
    }
    return 'de';
  }
}
