import { getRepository } from 'typeorm';
import { TraitPersistenceService } from './trait.persistence.service';
import { TRAIT_EXTRACTION_PROMPT } from '../ai/ai.constants';
import { AIService } from '../ai/ai.service';
import { MemoryPersistenceService } from '../ai/memory/memory.persistence.service';
import { SlackUser } from '../shared/db/models/SlackUser';
import { logger } from '../shared/logger/logger';

export class TraitJob {
  private traitPersistenceService = new TraitPersistenceService();
  private memoryPersistenceService = new MemoryPersistenceService();
  private aiService: AIService;
  private jobLogger = logger.child({ module: 'TraitJob' });

  constructor(aiService?: AIService) {
    this.aiService = aiService ?? new AIService();
  }

  async run(): Promise<void> {
    this.jobLogger.info('Starting trait regeneration job');

    try {
      // Get all users
      const users = await getRepository(SlackUser).find();

      if (users.length === 0) {
        this.jobLogger.info('No users found for trait regeneration');
        return;
      }

      // Extract all team IDs to regenerate traits for
      const teamIds = Array.from(new Set(users.map((u) => u.teamId)));

      let totalUsers = 0;
      let processedUsers = 0;

      for (const teamId of teamIds) {
        const teamUsers = users.filter((u) => u.teamId === teamId);
        totalUsers += teamUsers.length;

        const slackIds = teamUsers.map((u) => u.slackId);

        try {
          await this.runForUsers(teamId, slackIds);
          processedUsers += slackIds.length;
        } catch (error) {
          this.jobLogger.warn(`Failed to regenerate traits for team ${teamId}:`, error);
        }
      }

      this.jobLogger.info(`Trait regeneration job complete: processed ${processedUsers}/${totalUsers} users`);
    } catch (error) {
      this.jobLogger.error('Trait regeneration job failed:', error);
      throw error;
    }
  }

  async runForUsers(teamId: string, slackIds: string[]): Promise<void> {
    await this.regenerateTraitsForUsers(teamId, slackIds, async (input) => {
      return this.aiService.openAi.responses
        .create({
          model: 'gpt-4o-mini',
          instructions: TRAIT_EXTRACTION_PROMPT,
          input,
          user: `trait-job-${teamId}`,
        })
        .then((response) => {
          const textBlock = response.output.find((item) => item.type === 'message');
          if (textBlock && 'content' in textBlock) {
            const outputText = textBlock.content.find((item) => item.type === 'output_text');
            return outputText?.text.trim();
          }
          return undefined;
        });
    });
  }

  private parseTraitExtractionResult(raw: string | undefined): string[] {
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
      this.jobLogger.warn(`Trait extraction returned malformed JSON: ${raw}`);
      return [];
    }
  }

  private async regenerateTraitsForUsers(
    teamId: string,
    slackIds: string[],
    synthesizeTraits: (input: string) => Promise<string | undefined>,
  ): Promise<void> {
    const uniqueSlackIds = Array.from(new Set(slackIds.filter((id) => /^U[A-Z0-9]+$/.test(id))));
    if (uniqueSlackIds.length === 0) {
      return;
    }

    await this.processWithConcurrencyLimit(uniqueSlackIds, 3, async (slackId) => {
      const memories = await this.memoryPersistenceService.getAllMemoriesForUser(slackId, teamId);
      if (memories.length === 0) {
        await this.traitPersistenceService.replaceTraitsForUser(slackId, teamId, []);
        return;
      }

      const memoryText = memories.map((memory, index) => `${index + 1}. ${memory.content}`).join('\n');
      const input = `User Slack ID: ${slackId}\n\nMemories:\n${memoryText}`;

      const rawTraits = await synthesizeTraits(input).catch((error) => {
        this.jobLogger.warn(`Trait synthesis failed for ${slackId} in ${teamId}:`, error);
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
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        await worker(items[currentIndex]);
      }
    });

    await Promise.all(runners);
  }
}
