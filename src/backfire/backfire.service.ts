import { MAX_SUPPRESSIONS } from '../muzzle/constants';
import { SuppressorService } from '../shared/services/suppressor.service';

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
    const backfireId: number | undefined = await this.backfirePersistenceService
      .getBackfireByUserId(userId, teamId)
      .then(id => (id ? +id : undefined));
    if (backfireId) {
      const suppressions = await this.backfirePersistenceService.getSuppressions(userId, teamId);
      if (suppressions && +suppressions < MAX_SUPPRESSIONS) {
        this.backfirePersistenceService.addSuppression(userId, teamId);
        this.sendSuppressedMessage(channel, userId, text, timestamp, +backfireId, this.backfirePersistenceService);
      } else {
        this.webService.deleteMessage(channel, timestamp, userId);
        this.backfirePersistenceService.trackDeletedMessage(backfireId, text);
      }
    }
  }

  public getBackfire(userId: string, teamId: string): Promise<number | undefined> {
    return this.backfirePersistenceService.getBackfireByUserId(userId, teamId);
  }

  public trackDeletedMessage(id: number, text: string): void {
    this.backfirePersistenceService.trackDeletedMessage(id, text);
  }
}
