import { SlackService } from '../../services/slack/slack.service';
import { WebService } from '../../services/web/web.service';

export class ConfessionService {
  public webService: WebService;
  public slackService: SlackService;

  constructor(webService: WebService, slackService: SlackService) {
    this.webService = webService;
    this.slackService = slackService;
  }

  public async confess(requestorId: string, channelId: string, confession: string): Promise<void> {
    this.webService
      .sendMessage(channelId, `:chicken: <@${requestorId}> :chicken: says: \`${confession}\``)
      .catch((e) => console.error(e));
  }
}
