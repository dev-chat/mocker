import { KnownBlock } from '@slack/web-api';
import Axios, { AxiosResponse } from 'axios';
import { Definition, UrbanDictionaryResponse } from '../shared/models/define/define-models';
import { WebService } from '../shared/services/web/web.service';
import { logger } from '../shared/logger/logger';

export class DefineService {
  private logger = logger.child({ module: 'DefineService' });

  webService = new WebService();

  public capitalizeFirstLetter(sentence: string, all = true): string {
    if (all) {
      const words = sentence.split(' ');
      return words.map((word) => word.charAt(0).toUpperCase().concat(word.slice(1))).join(' ');
    }
    return sentence.charAt(0).toUpperCase() + sentence.slice(1, sentence.length);
  }

  public define(word: string, userId: string, channelId: string): Promise<void> {
    const formattedWord = word.split(' ').join('+');
    return Axios.get(encodeURI(`http://api.urbandictionary.com/v0/define?term=${formattedWord}`))
      .then((res: AxiosResponse<UrbanDictionaryResponse>) => {
        return res.data;
      })
      .then((data: UrbanDictionaryResponse) => {
        const formattedTitle = this.capitalizeFirstLetter(word);
        const definitions = this.formatDefs(data.list, formattedTitle);
        const blocks: KnownBlock[] = [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: formattedTitle,
            },
          },
        ];

        definitions.map((def) => blocks.push(def));

        blocks.push({
          type: 'divider',
        });

        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `:sparkles: _Definition requested by <@${userId}>, and provided by users just like you._ :sparkles:`,
            },
          ],
        });
        this.webService.sendMessage(channelId, formattedTitle, blocks).catch((e) => this.logger.error(e));
      });
  }

  public formatDefs(defArr: Definition[], definedWord: string, maxDefs = 3): KnownBlock[] {
    const noDefFound: KnownBlock[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '> Sorry, no definitions found.',
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
        const newLineNewLine = /(\n\n)/g;
        const definition = defArr[i].definition
          .replace(newLineNewLine, '')
          .replace(carriageAndNewLine, '\n> ')
          .replace(replaceBracket, '');

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `> ${this.capitalizeFirstLetter(definition, false)}`,
          },
        });
      }

      if (blocks.length === maxDefs) {
        return blocks;
      }
    }

    return blocks.length > 0 ? blocks : noDefFound;
  }
}
