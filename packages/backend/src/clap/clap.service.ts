import type { ChannelResponse } from '../shared/models/slack/slack-models';
import { logger } from '../shared/logger/logger';
import { SlackService } from '../shared/services/slack/slack.service';

export class ClapService {
  slackService = new SlackService();
  logger = logger.child({ module: 'ClapService' });

  public async clap(text: string, userId: string, responseUrl: string): Promise<void> {
    if (text) {
      let output = '';
      const words = text.trim().split(' ');
      for (let i = 0; i < words.length; i++) {
        output += i !== words.length - 1 ? `${words[i]} :clap: ` : `${words[i]} :clap:`;
      }

      const response: ChannelResponse = {
        attachments: [
          {
            text: output,
          },
        ],
        response_type: 'in_channel',
        text: `<@${userId}>`,
      };

      this.slackService.sendResponse(responseUrl, response);
    }
  }
}
