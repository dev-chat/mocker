import { WebService } from '../shared/services/web/web.service';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';
import type { MessageWithName } from '../shared/models/message/message-with-name';
import type { TraitWithSlackId } from '../shared/db/models/Trait';
import { TraitPersistenceService } from './trait.persistence.service';

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

  public formatTraitContext(traits: TraitWithSlackId[], history: MessageWithName[]): string {
    if (traits.length === 0) return '';

    const nameMap = new Map<string, string>();
    history.forEach((msg) => {
      if (msg.slackId && msg.name) nameMap.set(msg.slackId, msg.name);
    });

    const grouped = new Map<string, TraitWithSlackId[]>();
    for (const trait of traits) {
      const slackId = trait.slackId || 'unknown';
      if (!grouped.has(slackId)) grouped.set(slackId, []);
      grouped.get(slackId)!.push(trait);
    }

    const lines = Array.from(grouped.entries())
      .map(([slackId, userTraits]) => {
        const name = nameMap.get(slackId) || slackId;
        const traitLines = userTraits.map((trait) => `"${trait.content}"`).join(', ');
        return `- ${name}: ${traitLines}`;
      })
      .join('\n');

    return `<traits_context>\ncore beliefs and stable traits for people in this conversation:\n${lines}\n</traits_context>`;
  }

  public async fetchTraitContext(
    participantSlackIds: string[],
    teamId: string,
    history: MessageWithName[],
  ): Promise<string> {
    if (participantSlackIds.length === 0) return '';
    const traitsMap = await this.traitPersistenceService.getAllTraitsForUsers(participantSlackIds, teamId);
    const traits = Array.from(traitsMap.values()).flat();
    return this.formatTraitContext(traits, history);
  }

  public appendTraitContext(baseInstructions: string, traitContext: string): string {
    if (!traitContext) return baseInstructions;

    // Insert trait data before <verification> so the checklist remains the last thing the model sees.
    const verificationTag = '<verification>';
    const insertionPoint = baseInstructions.lastIndexOf(verificationTag);
    if (insertionPoint !== -1) {
      return `${baseInstructions.slice(0, insertionPoint)}${traitContext}\n\n${baseInstructions.slice(insertionPoint)}`;
    }

    return `${baseInstructions}\n\n${traitContext}`;
  }
}
