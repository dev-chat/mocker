import type { MessageWithName } from '../../shared/models/message/message-with-name';
import type { TraitWithSlackId } from '../../shared/db/models/Trait';
import { TraitPersistenceService } from './trait.persistence.service';

export class TraitService {
  private traitPersistenceService: TraitPersistenceService;

  constructor(traitPersistenceService?: TraitPersistenceService) {
    this.traitPersistenceService = traitPersistenceService ?? new TraitPersistenceService();
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
