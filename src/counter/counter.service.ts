import { CounterMuzzle } from '../shared/models/counter/counter-models';
import { COUNTER_TIME } from './constants';
import { SuppressorService } from '../shared/services/suppressor.service';
import { ABUSE_PENALTY_TIME, MAX_SUPPRESSIONS } from '../muzzle/constants';
import { getTimeString } from '../muzzle/muzzle-utilities';
import { EventRequest } from '../shared/models/slack/slack-models';

export class CounterService extends SuppressorService {
  /**
   * Creates a counter in DB and stores it in memory.
   */
  public createCounter(requestorId: string, teamId: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      if (!requestorId) {
        reject(`Invalid user. Only existing slack users can counter.`);
      } else if (this.counterPersistenceService.getCounterByRequestorId(requestorId)) {
        reject('You already have a counter for this user.');
      } else {
        await this.counterPersistenceService
          .addCounter(requestorId, teamId)
          .then(() => {
            resolve(`Counter set for the next ${getTimeString(COUNTER_TIME)}`);
          })
          .catch(e => reject(e));
      }
    });
  }

  public getCounterByRequestorId(requestorId: string): number | undefined {
    return this.counterPersistenceService.getCounterByRequestorId(requestorId);
  }

  public async sendCounterMuzzledMessage(
    channel: string,
    userId: string,
    text: string,
    timestamp: string,
  ): Promise<void> {
    const counterMuzzle: CounterMuzzle | undefined = this.counterPersistenceService.getCounterMuzzle(userId);
    if (counterMuzzle) {
      if (counterMuzzle.suppressionCount < MAX_SUPPRESSIONS) {
        this.counterPersistenceService.setCounterMuzzle(userId, {
          suppressionCount: ++counterMuzzle.suppressionCount,
          counterId: counterMuzzle.counterId,
          removalFn: counterMuzzle.removalFn,
        });
        this.sendSuppressedMessage(
          channel,
          userId,
          text,
          timestamp,
          +counterMuzzle.counterId,
          this.counterPersistenceService,
        );
      }
    }
  }

  public removeCounter(
    id: number,
    isUsed: boolean,
    userId: string,
    requestorId: string,
    channel: string,
    teamId: string,
  ): void {
    this.counterPersistenceService.removeCounter(id, isUsed, channel, teamId, requestorId);
    if (isUsed && channel) {
      this.counterPersistenceService.counterMuzzle(requestorId, id);
      this.muzzlePersistenceService.removeMuzzlePrivileges(requestorId, teamId);
      this.webService
        .sendMessage(
          channel,
          `:crossed_swords: <@${userId}> successfully countered <@${requestorId}>! <@${requestorId}> has lost muzzle privileges for 24 hours and is muzzled for the next 5 minutes! :crossed_swords:`,
        )
        .catch(e => console.error(e));
    }
  }

  async handle(request: EventRequest): Promise<void> {
    const isMessage = request.event.type === 'message' || request.event.type === 'message.channels' || request.event.type === 'message.app_home';
    const isTopicChange = !request.event.subtype || request.event.subtype === 'channel_topic';
    if (isMessage || isTopicChange) {
     const containsTag = this.slackService.containsTag(request.event.text);
      const userName = await this.slackService.getUserNameById(request.event.user, request.team_id);
      if (!containsTag) {
        console.log(`${userName} | ${request.event.user} is counter-muzzled! Suppressing his voice...`);
        this.sendCounterMuzzledMessage(
          request.event.channel,
          request.event.user,
          request.event.text,
          request.event.ts,
        );
      } else if (containsTag && isTopicChange) {
        console.log(`${userName} attempted to tag someone. Counter Muzzle increased by ${ABUSE_PENALTY_TIME}!`);
        this.counterPersistenceService.addCounterMuzzleTime(request.event.user, ABUSE_PENALTY_TIME);
        this.webService.deleteMessage(request.event.channel, request.event.ts, request.event.user);
        this.webService
          .sendMessage(
            request.event.channel,
            `:rotating_light: <@${request.event.user}> attempted to @ while countered! Muzzle increased by ${getTimeString(
              ABUSE_PENALTY_TIME,
            )} :rotating_light:`,
          )
          .catch((e) => console.error(e));
      }
    }
  }
}
