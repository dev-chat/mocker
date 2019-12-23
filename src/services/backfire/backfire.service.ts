import { IBackfire } from "../../shared/models/backfire/backfire.model";
import { MAX_SUPPRESSIONS, REPLACEMENT_TEXT } from "../muzzle/constants";
import { isRandomEven } from "../muzzle/muzzle-utilities";
import { SlackService } from "../slack/slack.service";
import { WebService } from "../web/web.service";
import { BackFirePersistenceService } from "./backfire.persistence.service";

export class BackfireService {
  private webService = WebService.getInstance();
  private slackService = SlackService.getInstance();
  private backfirePersistenceService = BackFirePersistenceService.getInstance();

  /**
   * Takes in text and randomly muzzles certain words.
   */
  public backfireMessage(text: string, muzzleId: number) {
    const words = text.split(" ");

    let returnText = "";
    let wordsSuppressed = 0;
    let charactersSuppressed = 0;
    let replacementWord;

    for (let i = 0; i < words.length; i++) {
      replacementWord = this.getReplacementWord(
        words[i],
        i === 0,
        i === words.length - 1,
        REPLACEMENT_TEXT
      );
      if (replacementWord.includes(REPLACEMENT_TEXT)) {
        wordsSuppressed++;
        charactersSuppressed += words[i].length;
      }
      returnText += replacementWord;
    }
    this.backfirePersistenceService.incrementMessageSuppressions(muzzleId);
    this.backfirePersistenceService.incrementCharacterSuppressions(
      muzzleId,
      charactersSuppressed
    );
    this.backfirePersistenceService.incrementWordSuppressions(
      muzzleId,
      wordsSuppressed
    );
    return returnText;
  }

  public addBackfireTime(userId: string, time: number) {
    this.backfirePersistenceService.addBackfireTime(userId, time);
  }

  public sendBackfiredMessage(
    channel: string,
    userId: string,
    text: string,
    timestamp: string
  ) {
    const backfire:
      | IBackfire
      | undefined = this.backfirePersistenceService.getBackfireByUserId(userId);
    if (backfire) {
      this.webService.deleteMessage(channel, timestamp);
      if (backfire!.suppressionCount < MAX_SUPPRESSIONS) {
        this.backfirePersistenceService.setBackfire(userId, {
          suppressionCount: ++backfire!.suppressionCount,
          id: backfire!.id,
          removalFn: backfire!.removalFn
        });
        this.webService.sendMessage(
          channel,
          `<@${userId}> says "${this.backfireMessage(text, backfire!.id)}"`
        );
      } else {
        this.backfirePersistenceService.trackDeletedMessage(backfire!.id, text);
      }
    }
  }

  public getBackfire(userId: string) {
    return this.backfirePersistenceService.getBackfireByUserId(userId);
  }

  public trackDeletedMessage(id: number, text: string) {
    this.backfirePersistenceService.trackDeletedMessage(id, text);
  }

  private getReplacementWord(
    word: string,
    isFirstWord: boolean,
    isLastWord: boolean,
    replacementText: string
  ) {
    const text =
      isRandomEven() &&
      word.length < 10 &&
      word !== " " &&
      !this.slackService.containsTag(word)
        ? `*${word}*`
        : replacementText;

    if ((isFirstWord && !isLastWord) || (!isFirstWord && !isLastWord)) {
      return `${text} `;
    }
    return text;
  }
}
