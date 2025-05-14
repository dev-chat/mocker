import { ABUSE_PENALTY_TIME, MAX_SUPPRESSIONS } from '../muzzle/constants';
import { getTimeString } from '../muzzle/muzzle-utilities';
import { logger } from '../shared/logger/logger';
import { EventRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';

export class BackfireService extends SuppressorService {
  logger = logger.child({ module: 'BackfireService' });

  public addBackfireTime(userId: string, teamId: string, time: number): void {
    this.backfirePersistenceService.addBackfireTime(userId, teamId, time);
  }

  public async sendBackfiredMessage(
    channel: string,
    userId: string,
    text: string,
    timestamp: string,
    teamId: string,
  ): Promise<void> {
    const backfireId: number | undefined = await this.backfirePersistenceService
      .getBackfireByUserId(userId, teamId)
      .then((id) => (id ? +id : undefined));
    if (backfireId) {
      const suppressions = await this.backfirePersistenceService.getSuppressions(userId, teamId);
      if (suppressions && +suppressions < MAX_SUPPRESSIONS) {
        this.backfirePersistenceService.addSuppression(userId, teamId);
        this.sendSuppressedMessage(channel, userId, text, timestamp, +backfireId, this.backfirePersistenceService);
      } else {
        this.webService.deleteMessage(channel, timestamp, userId);
        this.backfirePersistenceService.trackDeletedMessage(backfireId, text);
      }
    }
  }

  public getBackfire(userId: string, teamId: string): Promise<number | undefined> {
    return this.backfirePersistenceService.getBackfireByUserId(userId, teamId);
  }

  public trackDeletedMessage(id: number, text: string): void {
    this.backfirePersistenceService.trackDeletedMessage(id, text);
  }

  async handle(request: EventRequest): Promise<void> {
    const isMessage =
      request.event.type === 'message' ||
      request.event.type === 'message.channels' ||
      request.event.type === 'message.app_home';
    const isTopicChange = !request.event.subtype || request.event.subtype === 'channel_topic';
    if (isMessage || isTopicChange) {
      const isBackfired = await this.backfirePersistenceService.isBackfire(request.event.user, request.team_id);
      if (isBackfired) {
        const containsTag = this.slackService.containsTag(request.event.text);
        if (!containsTag) {
          this.webService.deleteMessage(request.event.channel, request.event.ts, request.event.user);
          this.sendBackfiredMessage(
            request.event.channel,
            request.event.user,
            request.event.text,
            request.event.ts,
            request.team_id,
          );
        } else if (containsTag && isTopicChange) {
          const backfireId = await this.getBackfire(request.event.user, request.team_id);
          if (backfireId) {
            this.addBackfireTime(request.event.user, request.team_id, ABUSE_PENALTY_TIME);
            this.webService.deleteMessage(request.event.channel, request.event.ts, request.event.user);
            this.trackDeletedMessage(backfireId, request.event.text);
            this.webService
              .sendMessage(
                request.event.channel,
                `:rotating_light: <@${request.event.user}> attempted to @ while muzzled! Muzzle increased by ${getTimeString(
                  ABUSE_PENALTY_TIME,
                )} :rotating_light:`,
              )
              .catch((e) => this.logger.error(e));
          } else {
            this.logger.warn(`Unable to find backfireId for ${request.event.user}`);
          }
        }
      }
    }
  }
}
