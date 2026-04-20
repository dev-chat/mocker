import { TraitPersistenceService } from '../ai/trait/trait.persistence.service';
import { WebService } from '../shared/services/web/web.service';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';

export class TraitService {
  private readonly traitPersistenceService = new TraitPersistenceService();
  private readonly webService = new WebService();
  private readonly traitLogger = logger.child({ module: 'TraitService' });

  public async sendTraitsForUser(userId: string, teamId: string, channelId: string): Promise<void> {
    try {
      const traits = await this.traitPersistenceService.getAllTraitsForUser(userId, teamId);

      if (traits.length === 0) {
        await this.webService.sendEphemeral(channelId, "Moonbeam doesn't have any core traits about you yet.", userId);
        return;
      }

      const formattedTraits = traits
        .map((trait, index) => {
          const date = new Date(trait.updatedAt).toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
          });
          return `${index + 1}. "${trait.content}" (${date.toLowerCase()})`;
        })
        .join('\n');

      const message = `Moonbeam's core traits about you:\n${formattedTraits}`;
      await this.webService.sendEphemeral(channelId, message, userId);
    } catch (e) {
      logError(this.traitLogger, 'Failed to fetch traits for /ai/traits command', e, {
        userId,
        teamId,
        channelId,
      });
      await this.webService.sendEphemeral(channelId, 'Sorry, something went wrong fetching your traits.', userId);
    }
  }
}
