import { getRepository } from 'typeorm';
import { SlackChannel } from '../shared/db/models/SlackChannel';
import { AIService } from './ai.service';
import { logger } from '../shared/logger/logger';

export class DailyMemoryJob {
  aiService: AIService;
  private jobLogger = logger.child({ module: 'DailyMemoryJob' });

  constructor(aiService?: AIService) {
    this.aiService = aiService ?? new AIService();
  }

  async run(): Promise<void> {
    this.jobLogger.info('Starting daily memory extraction job');

    const channels = await getRepository(SlackChannel).find();

    let processed = 0;
    for (const channel of channels) {
      try {
        await this.aiService.extractMemoriesForChannel(channel.teamId, channel.channelId);
        processed++;
      } catch (e) {
        this.jobLogger.warn(`Failed to extract memories for channel ${channel.channelId} (team ${channel.teamId}):`, e);
      }
    }

    this.jobLogger.info(`Daily memory extraction job complete: processed ${processed}/${channels.length} channels`);
  }
}
