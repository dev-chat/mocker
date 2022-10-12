import { CounterMuzzle } from '../../shared/models/counter/counter-models';
import { MAX_SUPPRESSIONS } from '../muzzle/constants';
import { getTimeString } from '../muzzle/muzzle-utilities';
import { COUNTER_TIME } from './constants';
import { SuppressorService } from '../../shared/services/suppressor.service';

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
      this.webService.sendMessage(
        channel,
        `:crossed_swords: <@${userId}> successfully countered <@${requestorId}>! <@${requestorId}> has lost muzzle privileges for 24 hours and is muzzled for the next 5 minutes! :crossed_swords:`,
      );
    }
  }
}
