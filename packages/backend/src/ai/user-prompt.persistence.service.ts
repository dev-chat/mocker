import { getRepository } from 'typeorm';
import { SlackUser } from '../shared/db/models/SlackUser';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';

export class UserPromptPersistenceService {
  private logger = logger.child({ module: 'UserPromptPersistenceService' });

  async getCustomPrompt(slackId: string, teamId: string): Promise<string | null> {
    return getRepository(SlackUser)
      .findOne({ where: { slackId, teamId } })
      .then((user) => user?.customPrompt ?? null)
      .catch((e) => {
        logError(this.logger, 'Error fetching custom prompt for user', e, { slackId, teamId });
        return null;
      });
  }

  async setCustomPrompt(slackId: string, teamId: string, prompt: string): Promise<boolean> {
    return getRepository(SlackUser)
      .update({ slackId, teamId }, { customPrompt: prompt })
      .then((result) => {
        if ((result.affected ?? 0) === 0) {
          this.logger.warn(`Cannot set custom prompt: user ${slackId} not found in team ${teamId}`);
          return false;
        }
        return true;
      })
      .catch((e) => {
        logError(this.logger, 'Error setting custom prompt for user', e, { slackId, teamId });
        return false;
      });
  }

  async clearCustomPrompt(slackId: string, teamId: string): Promise<boolean> {
    return getRepository(SlackUser)
      .update({ slackId, teamId }, { customPrompt: null })
      .then((result) => {
        if ((result.affected ?? 0) === 0) {
          this.logger.warn(`Cannot clear custom prompt: user ${slackId} not found in team ${teamId}`);
          return false;
        }
        return true;
      })
      .catch((e) => {
        logError(this.logger, 'Error clearing custom prompt for user', e, { slackId, teamId });
        return false;
      });
  }
}
