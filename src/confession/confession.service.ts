
import { SlackService } from '../shared/services/slack/slack.service';
import { WebService } from '../shared/services/web/web.service';
import { ConfessionPersistenceService } from './confession.persistence.service';

export class ConfessionService {
  public webService = WebService.getInstance();
  public slackService = SlackService.getInstance();
  public confessionPersistenceService = ConfessionPersistenceService.getInstance();

  public async confess(requestorId: string, teamId: string, channelId: string, confession: string): Promise<void> {
    console.log(`${requestorId} - ${teamId} attempted to confess ${confession} in ${channelId}`);
    this.webService
      .sendMessage(channelId, `:chicken: <@${requestorId}> :chicken: says: \`${confession}\``)
      .catch(e => console.error(e));
  }

  public async shouldBackfire(requestorId: string, teamId: string): Promise<boolean> {
    const confessions = await this.confessionPersistenceService.logConfession(requestorId, teamId);
    const chanceOfBackfire = confessions * 0.05;
    return Math.random() <= chanceOfBackfire;
  }
}
