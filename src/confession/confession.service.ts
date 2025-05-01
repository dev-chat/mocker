import { logger } from '../shared/logger/logger';
import { SlackService } from '../shared/services/slack/slack.service';
import { WebService } from '../shared/services/web/web.service';

export class ConfessionService {
  public webService = new WebService();
  public slackService = new SlackService();
  logger = logger.child({ module: 'ConfessionService' });

  public async confess(requestorId: string, channelId: string, confession: string): Promise<void> {
    this.webService
      .sendMessage(channelId, `:chicken: <@${requestorId}> :chicken: says: \`${confession}\``)
      .catch((e) => this.logger.error(e));
  }
}
