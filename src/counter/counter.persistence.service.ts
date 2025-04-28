import { getRepository, UpdateResult } from 'typeorm';
import { Counter } from '../shared/db/models/Counter';
import { CounterItem, CounterMuzzle } from '../shared/models/counter/counter-models';
import { WebService } from '../shared/services/web/web.service';
import { COUNTER_TIME, SINGLE_DAY_MS } from './constants';
import { MuzzlePersistenceService } from '../muzzle/muzzle.persistence.service';
import { getRemainingTime, Timeout } from '../muzzle/muzzle-utilities';
export class CounterPersistenceService {
  public static getInstance(): CounterPersistenceService {
    if (!CounterPersistenceService.instance) {
      CounterPersistenceService.instance = new CounterPersistenceService();
    }
    return CounterPersistenceService.instance;
  }

  private static instance: CounterPersistenceService;
  private muzzlePersistenceService: MuzzlePersistenceService = MuzzlePersistenceService.getInstance();
  private webService: WebService = WebService.getInstance();
  private counters: Map<number, CounterItem> = new Map();
  private counterMuzzles: Map<string, CounterMuzzle> = new Map();
  private onProbation: string[] = [];

  public addCounter(requestorId: string, teamId: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const counter = new Counter();
      counter.requestorId = requestorId;
      counter.teamId = teamId;
      counter.countered = false;

      await getRepository(Counter)
        .save(counter)
        .then(counterFromDb => {
          this.setCounterState(requestorId, counterFromDb.id, teamId);
          resolve();
        })
        .catch(e => reject(`Error on saving counter to DB: ${e}`));
    });
  }

  public addCounterMuzzleTime(userId: string, timeToAdd: number): void {
    const counterMuzzle = this.counterMuzzles.get(userId);
    if (userId && counterMuzzle) {
      const removalFn = counterMuzzle.removalFn;
      const newTime = getRemainingTime(removalFn) + timeToAdd;
      clearTimeout(counterMuzzle.removalFn);
      console.log(`Setting ${userId}'s muzzle time to ${newTime}`);
      this.counterMuzzles.set(userId, {
        suppressionCount: counterMuzzle.suppressionCount,
        counterId: counterMuzzle.counterId,
        removalFn: setTimeout(() => this.removeCounterMuzzle(userId), newTime) as Timeout,
      });
    }
  }

  public setCounterMuzzle(userId: string, options: CounterMuzzle): void {
    this.counterMuzzles.set(userId, options);
  }

  public async setCounteredToTrue(id: number, requestorId: string | undefined): Promise<Counter> {
    const counter = await getRepository(Counter).findOne({ where: { id } });
    counter!.countered = true;
    if (requestorId) {
      counter!.counteredId = requestorId;
    }
    return getRepository(Counter).save(counter as Counter);
  }

  public getCounter(counterId: number): CounterItem | undefined {
    return this.counters.get(counterId);
  }

  public isCounterMuzzled(userId: string): boolean {
    return this.counterMuzzles.has(userId);
  }

  public getCounterMuzzle(userId: string): CounterMuzzle | undefined {
    return this.counterMuzzles.get(userId);
  }

  public canCounter(requestorId: string): boolean {
    return !this.onProbation.includes(requestorId);
  }

  public hasCounter(userId: string): boolean {
    let hasCounter = false;
    this.counters.forEach(counter => {
      if (counter.requestorId === userId) {
        hasCounter = true;
      }
    });
    return hasCounter;
  }

  public counterMuzzle(userId: string, counterId: number): void {
    this.counterMuzzles.set(userId, {
      suppressionCount: 0,
      counterId,
      removalFn: setTimeout(() => this.removeCounterMuzzle(userId), COUNTER_TIME) as Timeout,
    });
  }

  /**
   * Retrieves the counterId for a counter that includes the specified requestorId.
   */
  public getCounterByRequestorId(requestorId: string): number | undefined {
    let counterId;
    this.counters.forEach((item, key) => {
      if (item.requestorId === requestorId) {
        counterId = key;
      }
    });

    return counterId;
  }

  public removeCounterPrivileges(userId: string): void {
    this.onProbation.push(userId);
    setTimeout(() => this.onProbation.splice(this.onProbation.indexOf(userId), 1), SINGLE_DAY_MS);
  }

  public async removeCounter(
    id: number,
    isUsed: boolean,
    channel: string,
    teamId: string,
    requestorId?: string,
  ): Promise<void> {
    const counter = this.counters.get(id);
    clearTimeout(counter!.removalFn);
    if (isUsed && channel) {
      this.counters.delete(id);
      await this.setCounteredToTrue(id, requestorId).catch(e => console.error('Error during setCounteredToTrue', e));
    } else {
      // This whole section is an anti-pattern. Fix this.
      this.counters.delete(id);
      this.counterMuzzle(counter!.requestorId, id);
      this.muzzlePersistenceService.removeMuzzlePrivileges(counter!.requestorId, teamId);
      this.removeCounterPrivileges(counter!.requestorId);
      this.webService
        .sendMessage(
          '#general',
          `:flesh: <@${
            counter!.requestorId
          }> lives in fear and is now muzzled, has lost muzzle privileges for 24 hours and cannot use counter again for 24 hours. :flesh:`,
        )
        .catch(e => console.error(e));
    }
  }

  public removeCounterMuzzle(userId: string): void {
    this.counterMuzzles.delete(userId);
  }

  private setCounterState(requestorId: string, counterId: number, teamId: string): void {
    this.counters.set(counterId, {
      requestorId,
      removalFn: setTimeout(() => this.removeCounter(counterId, false, '#general', teamId), COUNTER_TIME) as Timeout,
    });
  }

  public incrementMessageSuppressions(id: number): Promise<UpdateResult> {
    return getRepository(Counter).increment({ id }, 'messagesSuppressed', 1);
  }

  public incrementWordSuppressions(id: number, suppressions: number): Promise<UpdateResult> {
    return getRepository(Counter).increment({ id }, 'wordsSuppressed', suppressions);
  }

  public incrementCharacterSuppressions(id: number, charactersSuppressed: number): Promise<UpdateResult> {
    return getRepository(Counter).increment({ id }, 'charactersSuppressed', charactersSuppressed);
  }
}
