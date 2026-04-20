import { SlackUser } from '../../shared/db/models/SlackUser';
import { getRepository } from 'typeorm';
import { TraitService } from './trait.service';
import { AIService } from '../ai.service';
import { logger } from '../../shared/logger/logger';
import { TRAIT_EXTRACTION_PROMPT } from '../ai.constants';

export class TraitJob {
  private traitService: TraitService;
  private aiService: AIService;
  private jobLogger = logger.child({ module: 'TraitJob' });

  constructor(traitService?: TraitService, aiService?: AIService) {
    this.traitService = traitService ?? new TraitService();
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
          await this.traitService.regenerateTraitsForUsers(teamId, slackIds, async (input) => {
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
}
