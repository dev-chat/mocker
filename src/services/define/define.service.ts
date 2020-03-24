import Axios, { AxiosResponse } from "axios";
import {
  IDefinition,
  IUrbanDictionaryResponse
} from "../../shared/models/define/define-models";
import { IAttachment } from "../../shared/models/slack/slack-models";

export class DefineService {
  public static getInstance() {
    if (!DefineService.instance) {
      DefineService.instance = new DefineService();
    }
    return DefineService.instance;
  }

  private static instance: DefineService;

  private constructor() {}

  /**
   * Capitalizes the first letter of a given sentence.
   */
  public capitalizeFirstLetter(sentence: string): string {
    return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}`;
  }

  /**
   * Returns a promise to look up a definition on urban dictionary.
   */
  public define(word: string): Promise<IUrbanDictionaryResponse> {
    const formattedWord = word.split(" ").join("+");
    return Axios.get(
      `http://api.urbandictionary.com/v0/define?term=${formattedWord}`
    )
      .then((res: AxiosResponse<IUrbanDictionaryResponse>) => {
        return res.data;
      })
      .catch(e => {
        console.log("error", e);
        return e;
      });
  }

  /**
   * Takes in an array of definitions and breaks them down into a shortened list depending on maxDefs
   */
  public formatDefs(defArr: IDefinition[], definedWord: string, maxDefs = 3) {
    if (!defArr || defArr.length === 0) {
      return [{ text: "Sorry, no definitions found." }];
    }

    const formattedArr: IAttachment[] = [];

    for (let i = 0; i < defArr.length; i++) {
      if (defArr[i].word.toLowerCase() === definedWord.toLowerCase()) {
        formattedArr.push({
          text: this.formatUrbanD(
            `${i + 1}. ${this.capitalizeFirstLetter(defArr[i].definition)}`
          ),
          mrkdown_in: ["text"]
        });
      }

      if (formattedArr.length === maxDefs) {
        return formattedArr;
      }
    }
    return formattedArr.length
      ? formattedArr
      : [{ text: "Sorry, no definitions found." }];
  }
  /**
   * Takes in a definition and removes brackets.
   */
  private formatUrbanD(definition: string): string {
    let formattedDefinition: string = "";
    for (const letter of definition) {
      if (letter !== "[" && letter !== "]") {
        formattedDefinition += letter;
      }
    }
    return formattedDefinition;
  }
}
