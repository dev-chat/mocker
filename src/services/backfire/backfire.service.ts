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
    isPrivate: boolean,
  ): Promise<void> {
    const backfireId: string | null = await this.backfirePersistenceService.getBackfireByUserId(userId, teamId);
    if (backfireId) {
      this.webService.deleteMessage(channel, timestamp, isPrivate);
      const suppressions = await this.backfirePersistenceService.getSuppressions(userId, teamId);
      if (suppressions && +suppressions < MAX_SUPPRESSIONS) {
        this.backfirePersistenceService.incrementMessageSuppressions(+backfireId);
        this.backfirePersistenceService.addSuppression(userId, teamId);
        this.webService.sendMessage(
          channel,
          `<@${userId}> says "${this.sendSuppressedMessage(text, +backfireId, this.backfirePersistenceService)}"`,
        );
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
