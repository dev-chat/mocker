import { MAX_SUPPRESSIONS } from '../muzzle/constants';
import { SuppressorService } from '../../shared/services/suppressor.service';

export class BackfireService extends SuppressorService {
  public addBackfireTime(userId: string, teamId: string, time: number): void {
    this.backfirePersistenceService.addBackfireTime(userId, teamId, time);
  }

  public async sendBackfiredMessage(
    channel: string,
    userId: string,
    text: string,
    timestamp: string,
    teamId: string,
  ): Promise<void> {
    const backfireId: string | null = await this.backfirePersistenceService.getBackfireByUserId(userId, teamId);
    if (backfireId) {
      this.webService.deleteMessage(channel, timestamp);
      const suppressions = await this.backfirePersistenceService.getSuppressions(userId, teamId);
      if (suppressions && +suppressions < MAX_SUPPRESSIONS) {
        this.backfirePersistenceService.incrementMessageSuppressions(+backfireId);
        this.backfirePersistenceService.addSuppression(userId, teamId);
        let suppressedMessage: any = await this.translationService.translate(text).catch(e => {
          console.error('error on translation');
          console.error(e);
          return null;
        });

        if (!!suppressedMessage) {
          await this.logTranslateSuppression(text, +backfireId, this.backfirePersistenceService);
        } else {
          suppressedMessage = this.sendSuppressedMessage(text, +backfireId, this.backfirePersistenceService);
        }
        this.webService.sendMessage(channel, `<@${userId}> says "${suppressedMessage}"`);
      } else {
        this.backfirePersistenceService.trackDeletedMessage(+backfireId, text);
      }
    }
  }

  public async getBackfire(userId: string, teamId: string): Promise<string | null> {
    return await this.backfirePersistenceService.getBackfireByUserId(userId, teamId);
  }

  public trackDeletedMessage(id: number, text: string): void {
    this.backfirePersistenceService.trackDeletedMessage(id, text);
  }
}
