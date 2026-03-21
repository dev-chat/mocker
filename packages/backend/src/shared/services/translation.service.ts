import type { AxiosResponse } from 'axios';
import Axios from 'axios';

export class TranslationService {
  public translate(text: string): Promise<string | undefined> {
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
      const data = res.data;
      if (!data || typeof data !== 'object') {
        return undefined;
      }

      const payload = Reflect.get(data, 'data');
      if (!payload || typeof payload !== 'object') {
        return undefined;
      }

      const translations = Reflect.get(payload, 'translations');
      if (!Array.isArray(translations) || translations.length === 0) {
        return undefined;
      }

      const firstTranslation = translations[0];
      const translatedText =
        firstTranslation && typeof firstTranslation === 'object'
          ? Reflect.get(firstTranslation, 'translatedText')
          : undefined;

      return typeof translatedText === 'string' ? translatedText : undefined;
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
