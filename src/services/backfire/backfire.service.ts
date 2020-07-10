import { MAX_SUPPRESSIONS } from '../muzzle/constants';
import { SuppressorService } from '../../shared/services/suppressor.service';

export class BackfireService extends SuppressorService {
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
        this.webService.sendMessage(
          channel,
          `<@${userId}> says "${this.sendSuppressedMessage(text, +backfireId, this.backfirePersistenceService)}"`,
        );
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
