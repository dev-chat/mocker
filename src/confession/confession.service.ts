
import { SlackService } from '../shared/services/slack/slack.service';
import { WebService } from '../shared/services/web/web.service';

export class ConfessionService {
  public webService = WebService.getInstance();
  public slackService = SlackService.getInstance();

  public async confess(requestorId: string, teamId: string, channelId: string, confession: string): Promise<void> {
    console.log(`${requestorId} - ${teamId} attempted to confess ${confession} in ${channelId}`);
    this.webService
      .sendMessage(channelId, `:chicken: <@${requestorId}> :chicken: says: \`${confession}\``)
      .catch(e => console.error(e));
  }
}
