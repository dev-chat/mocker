import { getRepository } from 'typeorm';
import { SlackChannel } from '../../shared/db/models/SlackChannel';
import { HistoryPersistenceService } from '../../shared/services/history.persistence.service';
import { MemoryService } from './memory.service';
import { TraitService } from '../trait/trait.service';
import { AIService } from '../ai.service';
import { logger } from '../../shared/logger/logger';
import { DAILY_MEMORY_JOB_CONCURRENCY, GATE_MODEL, TRAIT_EXTRACTION_PROMPT } from '../ai.constants';
import { MOONBEAM_SLACK_ID } from '../ai.constants';
import type OpenAI from 'openai';

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
  private memoryService = new MemoryService();
  private traitService = new TraitService();
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
    const participantSlackIds = this.traitService.extractParticipantSlackIds(historyMessages, {
      excludeSlackIds: [MOONBEAM_SLACK_ID],
    });
    if (participantSlackIds.length === 0) return;

    await this.memoryService.extractMemories(
      teamId,
      channelId,
      history,
      participantSlackIds,
      async (prompt, input) => {
        return this.aiService.openAi.responses
          .create({
            model: GATE_MODEL,
            instructions: prompt,
            input,
          })
          .then((x) => extractAndParseOpenAiResponse(x));
      },
      async (regenTeamId, slackIds) => {
        await this.traitService.regenerateTraitsForUsers(regenTeamId, slackIds, async (input) => {
          return this.aiService.openAi.responses
            .create({
              model: GATE_MODEL,
              instructions: TRAIT_EXTRACTION_PROMPT,
              input,
            })
            .then((response) => extractAndParseOpenAiResponse(response));
        });
      },
    );
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
