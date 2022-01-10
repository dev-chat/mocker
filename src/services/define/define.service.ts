import Axios, { AxiosResponse } from 'axios';
import { Definition, UrbanDictionaryResponse } from '../../shared/models/define/define-models';
import { Attachment } from '../../shared/models/slack/slack-models';

export class DefineService {
  public static getInstance(): DefineService {
    if (!DefineService.instance) {
      DefineService.instance = new DefineService();
    }
    return DefineService.instance;
  }

  private static instance: DefineService;

  /**
   * Capitalizes the first letter of a given sentence.
   */
  public capitalizeFirstLetter(sentence: string, all = true): string {
    if (all) {
      const words = sentence.split(' ');
      return words
        .map(word =>
          word
            .charAt(0)
            .toUpperCase()
            .concat(word.slice(1)),
        )
        .join(' ');
    }
    return sentence.charAt(0).toUpperCase() + sentence.slice(1, sentence.length);
  }

  /**
   * Returns a promise to look up a definition on urban dictionary.
   */
  public define(word: string): Promise<UrbanDictionaryResponse> {
    const formattedWord = word.split(' ').join('+');
    return Axios.get(`http://api.urbandictionary.com/v0/define?term=${formattedWord}`).then(
      (res: AxiosResponse<UrbanDictionaryResponse>) => {
        return res.data;
      },
    );
  }

  /**
   * Takes in an array of definitions and breaks them down into a shortened list depending on maxDefs
   */
  public formatDefs(defArr: Definition[], definedWord: string, maxDefs = 3): string {
    if (!defArr || defArr.length === 0) {
      return 'Sorry, no definitions found.';
    }

    let definitions = '';

    for (let i = 0; i < defArr.length; i++) {
      if (defArr[i].word.toLowerCase() === definedWord.toLowerCase()) {
        definitions += `${this.formatUrbanD(
          `${i + 1}. ${this.capitalizeFirstLetter(defArr[i].definition, false)}`,
        )} \n`;
      }

      if (i === maxDefs - 1) {
        return definitions;
      }
    }

    return definitions.length ? definitions : 'Sorry, no definitions found.';
  }
  /**
   * Takes in a definition and removes brackets.
   */
  private formatUrbanD(definition: string): string {
    let formattedDefinition = '';
    for (const letter of definition) {
      if (letter !== '[' && letter !== ']') {
        formattedDefinition += letter;
      }
    }
    return formattedDefinition;
  }
}
