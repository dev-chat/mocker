import { KnownBlock } from '@slack/web-api';
import Axios, { AxiosResponse } from 'axios';
import { Definition, UrbanDictionaryResponse } from '../../shared/models/define/define-models';

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
  public formatDefs(defArr: Definition[], definedWord: string, maxDefs = 3): KnownBlock[] {
    const noDefFound: KnownBlock[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Sorry, no definitions found.',
        },
      },
    ];

    if (!defArr || defArr.length === 0) {
      return noDefFound;
    }

    const blocks: KnownBlock[] = [];

    for (let i = 0; i < defArr.length; i++) {
      if (defArr[i].word.toLowerCase() === definedWord.toLowerCase()) {
        const carriageAndNewLine = /(\r\n)/g;
        const replaceBracket = /[\[\]]/g;
        const definition = defArr[i].definition.replace(carriageAndNewLine, '\n>\n> ').replace(replaceBracket, '');

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `> ${`${i + 1}. ${this.capitalizeFirstLetter(definition)}`}`,
          },
        });
      }

      if (i === maxDefs - 1) {
        return blocks;
      }
    }

    return blocks.length > 0 ? blocks : noDefFound;
  }
}
