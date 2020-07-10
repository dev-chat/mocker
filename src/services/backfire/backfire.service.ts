import { MAX_SUPPRESSIONS, REPLACEMENT_TEXT } from '../muzzle/constants';
import { SuppressorService } from '../../shared/services/suppressor.service';

export class BackfireService extends SuppressorService {
  /**
   * Takes in text and randomly muzzles words.
   */
  public backfireMessage(text: string, backfireId: number): string {
    const words = text.split(' ');

    let returnText = '';
    let wordsSuppressed = 0;
    let charactersSuppressed = 0;
    let replacementWord;

    for (let i = 0; i < words.length; i++) {
      replacementWord = this.getReplacementWord(
        words[i],
        i === 0,
        i === words.length - 1,
        REPLACEMENT_TEXT[Math.floor(Math.random() * REPLACEMENT_TEXT.length)],
      );
      if (replacementWord.includes(REPLACEMENT_TEXT[Math.floor(Math.random() * REPLACEMENT_TEXT.length)])) {
        wordsSuppressed++;
        charactersSuppressed += words[i].length;
      }
      returnText += replacementWord;
    }
    this.backfirePersistenceService.incrementMessageSuppressions(backfireId);
    this.backfirePersistenceService.incrementCharacterSuppressions(backfireId, charactersSuppressed);
    this.backfirePersistenceService.incrementWordSuppressions(backfireId, wordsSuppressed);
    return returnText;
  }

  public addBackfireTime(userId: string, time: number): void {
    this.backfirePersistenceService.addBackfireTime(userId, time);
  }

  public async sendBackfiredMessage(channel: string, userId: string, text: string, timestamp: string): Promise<void> {
    const backfireId: string | null = await this.backfirePersistenceService.getBackfireByUserId(userId);
    if (backfireId) {
      this.webService.deleteMessage(channel, timestamp);
      const suppressions = await this.backfirePersistenceService.getSuppressions(userId);
      if (suppressions && +suppressions < MAX_SUPPRESSIONS) {
        this.backfirePersistenceService.incrementMessageSuppressions(+backfireId);
        this.webService.sendMessage(channel, `<@${userId}> says "${this.backfireMessage(text, +backfireId)}"`);
      } else {
        this.backfirePersistenceService.trackDeletedMessage(+backfireId, text);
      }
    }
  }

  public async getBackfire(userId: string): Promise<string | null> {
    return await this.backfirePersistenceService.getBackfireByUserId(userId);
  }

  public trackDeletedMessage(id: number, text: string): void {
    this.backfirePersistenceService.trackDeletedMessage(id, text);
  }
}
