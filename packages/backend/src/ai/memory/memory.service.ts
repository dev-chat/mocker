import { MEMORY_EXTRACTION_PROMPT } from '../ai.constants';
import { MemoryPersistenceService } from './memory.persistence.service';
import { logger } from '../../shared/logger/logger';

interface ExtractionResult {
  slackId: string;
  content: string;
  mode: 'NEW' | 'REINFORCE' | 'EVOLVE';
  existingMemoryId: number | null;
}

interface ExtractionLockStore {
  getExtractionLock(channelId: string, teamId: string): Promise<string | null>;
  setExtractionLock(channelId: string, teamId: string): Promise<unknown | null>;
}

export class MemoryService {
  private memoryLogger: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void };
  private memoryPersistenceService: MemoryPersistenceService;
  private extractionLockStore: ExtractionLockStore;

  constructor(
    memoryPersistenceService?: MemoryPersistenceService,
    extractionLockStore?: ExtractionLockStore,
    memoryLogger?: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void },
  ) {
    this.memoryPersistenceService = memoryPersistenceService ?? new MemoryPersistenceService();
    this.extractionLockStore = extractionLockStore ?? {
      getExtractionLock: async () => null,
      setExtractionLock: async () => null,
    };
    this.memoryLogger = memoryLogger ?? logger.child({ module: 'AIMemoryService' });
  }

  public async extractMemories(
    teamId: string,
    channelId: string,
    conversationHistory: string,
    participantSlackIds: string[],
    extractFromConversation: (prompt: string, input: string) => Promise<string | undefined>,
    regenerateTraitsForUsers: (teamId: string, slackIds: string[]) => Promise<void>,
  ): Promise<void> {
    const locked = await this.extractionLockStore.getExtractionLock(channelId, teamId);
    if (locked) {
      this.memoryLogger.info(`Extraction lock active for ${channelId}-${teamId}, skipping`);
      return;
    }
    await this.extractionLockStore.setExtractionLock(channelId, teamId);

    try {
      const existingMemoriesMap = await this.memoryPersistenceService.getAllMemoriesForUsers(
        participantSlackIds,
        teamId,
      );

      const existingMemoriesText =
        existingMemoriesMap.size > 0
          ? Array.from(existingMemoriesMap.entries())
              .map(([slackId, memories]) => {
                const lines = memories.map((m) => `  [ID:${m.id}] "${m.content}"`).join('\n');
                return `${slackId}:\n${lines}`;
              })
              .join('\n\n')
          : '(no existing memories)';

      const prompt = MEMORY_EXTRACTION_PROMPT.replace('{existing_memories}', existingMemoriesText);
      const result = await extractFromConversation(prompt, conversationHistory);

      if (!result) {
        this.memoryLogger.warn('Extraction returned no result');
        return;
      }

      const trimmed = result.trim();
      if (trimmed === 'NONE' || trimmed === '"NONE"') return;

      let extractions: Array<Partial<ExtractionResult>>;
      try {
        const parsed: unknown = JSON.parse(trimmed);
        extractions = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        this.memoryLogger.warn(`Extraction returned malformed JSON: ${trimmed}`);
        return;
      }

      const touchedUsers = new Set<string>();

      for (const extraction of extractions) {
        if (!extraction.slackId || !extraction.content || !extraction.mode) {
          this.memoryLogger.warn('Extraction missing required fields, skipping:', extraction);
          continue;
        }

        if (!/^U[A-Z0-9]+$/.test(extraction.slackId)) {
          this.memoryLogger.warn(`Invalid slackId format: ${extraction.slackId}`);
          continue;
        }

        switch (extraction.mode) {
          case 'NEW':
            await this.memoryPersistenceService.saveMemories(extraction.slackId, teamId, [extraction.content]);
            touchedUsers.add(extraction.slackId);
            break;

          case 'REINFORCE':
            if (extraction.existingMemoryId) {
              await this.memoryPersistenceService.reinforceMemory(extraction.existingMemoryId);
              touchedUsers.add(extraction.slackId);
            } else {
              this.memoryLogger.warn('REINFORCE extraction missing existingMemoryId, skipping');
            }
            break;

          case 'EVOLVE':
            if (extraction.existingMemoryId) {
              await this.memoryPersistenceService.deleteMemory(extraction.existingMemoryId);
            }
            await this.memoryPersistenceService.saveMemories(extraction.slackId, teamId, [extraction.content]);
            touchedUsers.add(extraction.slackId);
            break;

          default:
            this.memoryLogger.warn(`Unknown extraction mode: ${String(extraction.mode)}`);
        }
      }

      await regenerateTraitsForUsers(teamId, [...touchedUsers]);

      this.memoryLogger.info(`Extraction complete for ${channelId}: ${extractions.length} observations processed`);
    } catch (e) {
      this.memoryLogger.warn('Memory extraction failed:', e);
    }
  }
}
