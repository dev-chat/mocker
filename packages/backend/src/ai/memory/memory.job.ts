import { getRepository } from 'typeorm';
import { SlackChannel } from '../../shared/db/models/SlackChannel';
import { HistoryPersistenceService } from '../../shared/services/history.persistence.service';
import { MemoryPersistenceService } from './memory.persistence.service';
import { RedisPersistenceService } from '../../shared/services/redis.persistence.service';
import { AIService } from '../ai.service';
import { logger } from '../../shared/logger/logger';
import { DAILY_MEMORY_JOB_CONCURRENCY, GATE_MODEL, MEMORY_EXTRACTION_PROMPT } from '../ai.constants';
import { MOONBEAM_SLACK_ID } from '../ai.constants';
import type OpenAI from 'openai';
import { extractParticipantSlackIds } from '../helpers/extractParticipantSlackIds';

interface ExtractionResult {
  slackId: string;
  content: string;
  mode: 'NEW' | 'REINFORCE' | 'EVOLVE';
  existingMemoryId: number | null;
}

const extractAndParseOpenAiResponse = (response: OpenAI.Responses.Response): string | undefined => {
  const textBlock = response.output.find((item) => item.type === 'message');
  if (textBlock && 'content' in textBlock) {
    const outputText = textBlock.content.find((item) => item.type === 'output_text');
    return outputText?.text.trim();
  }
  return undefined;
};

export class MemoryJob {
  private historyService = new HistoryPersistenceService();
  private memoryPersistenceService = new MemoryPersistenceService();
  private redis = new RedisPersistenceService();
  private aiService: AIService;
  private jobLogger = logger.child({ module: 'MemoryJob' });

  constructor(aiService?: AIService) {
    this.aiService = aiService ?? new AIService();
  }

  async run(): Promise<void> {
    this.jobLogger.info('Starting memory extraction job');

    const channels = await getRepository(SlackChannel).find();

    const results = await this.runWithConcurrencyLimit(
      channels.map((channel) => () => this.extractMemoriesForChannel(channel.teamId, channel.channelId)),
      DAILY_MEMORY_JOB_CONCURRENCY,
    );

    const failed = results
      .map((result, index) => ({ result, index }))
      .filter((item): item is { result: PromiseRejectedResult; index: number } => item.result.status === 'rejected');
    failed.forEach(({ result, index }) => {
      const channel = channels[index];
      this.jobLogger.warn(
        `Failed to extract memories for channel ${channel.channelId} (team ${channel.teamId}):`,
        result.reason,
      );
    });

    const processed = results.length - failed.length;
    this.jobLogger.info(`Memory extraction job complete: processed ${processed}/${channels.length} channels`);
  }

  private async extractMemoriesForChannel(teamId: string, channelId: string): Promise<void> {
    const historyMessages = await this.historyService.getLast24HoursForChannel(teamId, channelId);
    if (historyMessages.length === 0) return;

    const history = this.aiService.formatHistory(historyMessages);
    const participantSlackIds = extractParticipantSlackIds(historyMessages, {
      excludeSlackIds: [MOONBEAM_SLACK_ID],
    });
    if (participantSlackIds.length === 0) return;

    await this.extractMemories(teamId, channelId, history, participantSlackIds);
  }

  private async extractMemories(
    teamId: string,
    channelId: string,
    conversationHistory: string,
    participantSlackIds: string[],
  ): Promise<void> {
    const lockKey = `memory_extraction_lock:${teamId}:${channelId}`;
    const locked = await this.redis.getValue(lockKey);
    if (locked) {
      this.jobLogger.info(`Extraction lock active for ${channelId}-${teamId}, skipping`);
      return;
    }
    await this.redis.setValueWithExpire(lockKey, 1, 'PX', 60 * 5);

    try {
      const existingMemoriesMap = await this.memoryPersistenceService.getAllMemoriesForUsers(
        participantSlackIds,
        teamId,
      );
      const existingMemoriesText =
        existingMemoriesMap.size > 0
          ? Array.from(existingMemoriesMap.entries())
              .map(([slackId, memories]) => {
                const lines = memories.map((memory) => `  [ID:${memory.id}] "${memory.content}"`).join('\n');
                return `${slackId}:\n${lines}`;
              })
              .join('\n\n')
          : '(no existing memories)';

      const prompt = MEMORY_EXTRACTION_PROMPT.replace('{existing_memories}', existingMemoriesText);
      const result = await this.aiService.openAi.responses
        .create({
          model: GATE_MODEL,
          instructions: prompt,
          input: conversationHistory,
        })
        .then((response) => extractAndParseOpenAiResponse(response));

      if (!result) {
        this.jobLogger.warn('Extraction returned no result');
        return;
      }

      const trimmed = result.trim();
      if (trimmed === 'NONE' || trimmed === '"NONE"') {
        return;
      }

      const extractions = this.parseExtractionResults(trimmed);
      if (!extractions) {
        return;
      }

      const touchedUsers = new Set<string>();
      for (const extraction of extractions) {
        const wasTouched = await this.applyExtraction(teamId, extraction);
        if (wasTouched && extraction.slackId) {
          touchedUsers.add(extraction.slackId);
        }
      }

      this.jobLogger.info(`Extraction complete for ${channelId}: ${extractions.length} observations processed`);
    } catch (error) {
      this.jobLogger.warn('Memory extraction failed:', error);
    }
  }

  private parseExtractionResults(trimmedResult: string): Array<Partial<ExtractionResult>> | null {
    try {
      const parsed: Array<Partial<ExtractionResult>> = JSON.parse(trimmedResult);
      return parsed;
    } catch {
      this.jobLogger.warn(`Extraction returned malformed JSON: ${trimmedResult}`);
      return null;
    }
  }

  private async applyExtraction(teamId: string, extraction: Partial<ExtractionResult>): Promise<boolean> {
    if (!extraction.slackId || !extraction.content || !extraction.mode) {
      this.jobLogger.warn('Extraction missing required fields, skipping:', extraction);
      return false;
    }

    if (!/^U[A-Z0-9]+$/.test(extraction.slackId)) {
      this.jobLogger.warn(`Invalid slackId format: ${extraction.slackId}`);
      return false;
    }

    switch (extraction.mode) {
      case 'NEW':
        await this.memoryPersistenceService.saveMemories(extraction.slackId, teamId, [extraction.content]);
        return true;
      case 'REINFORCE':
        if (!extraction.existingMemoryId) {
          this.jobLogger.warn('REINFORCE extraction missing existingMemoryId, skipping');
          return false;
        }
        await this.memoryPersistenceService.reinforceMemory(extraction.existingMemoryId);
        return true;
      case 'EVOLVE':
        if (extraction.existingMemoryId) {
          await this.memoryPersistenceService.deleteMemory(extraction.existingMemoryId);
        }
        await this.memoryPersistenceService.saveMemories(extraction.slackId, teamId, [extraction.content]);
        return true;
      default:
        this.jobLogger.warn(`Unknown extraction mode: ${String(extraction.mode)}`);
        return false;
    }
  }

  private async runWithConcurrencyLimit<T>(
    tasks: Array<() => Promise<T>>,
    concurrency: number,
  ): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = new Array(tasks.length);
    let nextIndex = 0;

    const runNext = async (): Promise<void> => {
      while (nextIndex < tasks.length) {
        const index = nextIndex++;
        try {
          results[index] = { status: 'fulfilled', value: await tasks[index]() };
        } catch (reason) {
          results[index] = { status: 'rejected', reason };
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => runNext()));
    return results;
  }
}
