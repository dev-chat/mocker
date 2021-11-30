import { SlackService } from '../../services/slack/slack.service';
import { WebService } from '../../services/web/web.service';
import { ConfessionPersistenceService } from './confession.persistence.service';

export class ConfessionService {
  public webService = WebService.getInstance();
  public slackService = SlackService.getInstance();
  public confessionPersistenceService = ConfessionPersistenceService.getInstance();

  public async confess(requestorId: string, teamId: string, channelId: string, confession: string): Promise<void> {
    const message = (await this.shouldBackfire(requestorId, teamId))
      ? `<@${requestorId}> has confessed: 
      \`${confession}\``
      : `Someone has confessed: 
      \`${confession}\``;
    this.webService.sendMessage(channelId, message);
  }

  public async shouldBackfire(requestorId: string, teamId: string): Promise<boolean> {
    const confessions = await this.confessionPersistenceService.logConfession(requestorId, teamId);
    const chanceOfBackfire = confessions * 0.05;
    return Math.random() <= chanceOfBackfire;
  }
}
