import { getRepository } from 'typeorm';
import { SlackChannel } from '../shared/db/models/SlackChannel';
import { AIService } from './ai.service';
import { logger } from '../shared/logger/logger';
import { DAILY_MEMORY_JOB_CONCURRENCY } from './ai.constants';

export class DailyMemoryJob {
  aiService: AIService;
  private jobLogger = logger.child({ module: 'DailyMemoryJob' });

  constructor(aiService?: AIService) {
    this.aiService = aiService ?? new AIService();
  }

  async run(): Promise<void> {
    this.jobLogger.info('Starting daily memory extraction job');

    const channels = await getRepository(SlackChannel).find();

    const results = await this.runWithConcurrencyLimit(
      channels.map((channel) => () => this.aiService.extractMemoriesForChannel(channel.teamId, channel.channelId)),
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
    this.jobLogger.info(`Daily memory extraction job complete: processed ${processed}/${channels.length} channels`);
  }

  private async runWithConcurrencyLimit<T>(
    tasks: Array<() => Promise<T>>,
    concurrency: number,
  ): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = [];
    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(batch.map((task) => task()));
      results.push(...batchResults);
    }
    return results;
  }
}
