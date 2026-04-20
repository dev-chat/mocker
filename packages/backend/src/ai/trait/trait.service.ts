import type { MessageWithName } from '../../shared/models/message/message-with-name';
import type { TraitWithSlackId } from '../../shared/db/models/Trait';
import { TraitPersistenceService } from './trait.persistence.service';
import { MemoryPersistenceService } from '../memory/memory.persistence.service';
import { logger } from '../../shared/logger/logger';

export class TraitService {
  private traitLogger: { warn: (...args: unknown[]) => void };
  private traitPersistenceService: TraitPersistenceService;
  private memoryPersistenceService: MemoryPersistenceService;

  constructor(
    traitPersistenceService?: TraitPersistenceService,
    memoryPersistenceService?: MemoryPersistenceService,
    traitLogger?: { warn: (...args: unknown[]) => void },
  ) {
    this.traitPersistenceService = traitPersistenceService ?? new TraitPersistenceService();
    this.memoryPersistenceService = memoryPersistenceService ?? new MemoryPersistenceService();
    this.traitLogger = traitLogger ?? logger.child({ module: 'AITraitService' });
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

  public extractParticipantSlackIds(
    history: MessageWithName[],
    options?: { includeSlackId?: string; excludeSlackIds?: string[] },
  ): string[] {
    const excludeSet = new Set(options?.excludeSlackIds || []);
    const ids = [
      ...new Set(history.filter((msg) => msg.slackId && !excludeSet.has(msg.slackId!)).map((msg) => msg.slackId!)),
    ];
    if (options?.includeSlackId && !ids.includes(options.includeSlackId)) {
      ids.push(options.includeSlackId);
    }
    return ids;
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

  public parseTraitExtractionResult(raw: string | undefined): string[] {
    if (!raw) {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(raw.trim());
      if (!Array.isArray(parsed)) {
        return [];
      }

      return Array.from(
        new Set(
          parsed
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim())
            .filter((value) => value.length > 0),
        ),
      ).slice(0, 10);
    } catch {
      this.traitLogger.warn(`Trait extraction returned malformed JSON: ${raw}`);
      return [];
    }
  }

  public async regenerateTraitsForUsers(
    teamId: string,
    slackIds: string[],
    synthesizeTraits: (input: string) => Promise<string | undefined>,
  ): Promise<void> {
    const uniqueSlackIds = Array.from(new Set(slackIds.filter((id) => /^U[A-Z0-9]+$/.test(id))));
    if (uniqueSlackIds.length === 0) {
      return;
    }

    const traitRegenerationConcurrency = 3;

    await this.processWithConcurrencyLimit(uniqueSlackIds, traitRegenerationConcurrency, async (slackId) => {
      const memories = await this.memoryPersistenceService.getAllMemoriesForUser(slackId, teamId);
      if (memories.length === 0) {
        await this.traitPersistenceService.replaceTraitsForUser(slackId, teamId, []);
        return;
      }

      const memoryText = memories.map((memory, index) => `${index + 1}. ${memory.content}`).join('\n');
      const input = `User Slack ID: ${slackId}\n\nMemories:\n${memoryText}`;

      const rawTraits = await synthesizeTraits(input).catch((error) => {
        this.traitLogger.warn(`Trait synthesis failed for ${slackId} in ${teamId}:`, error);
        return undefined;
      });

      const traits = this.parseTraitExtractionResult(rawTraits);
      await this.traitPersistenceService.replaceTraitsForUser(slackId, teamId, traits);
    });
  }

  private async processWithConcurrencyLimit<T>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<void>,
  ): Promise<void> {
    const effectiveConcurrency = Math.max(1, Math.min(concurrency, items.length));
    let nextIndex = 0;

    const runners = Array.from({ length: effectiveConcurrency }, async () => {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      await worker(items[currentIndex]);
    });

    await Promise.all(runners);
  }
}
