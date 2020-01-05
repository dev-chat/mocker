import { getRepository } from "typeorm";
import { Counter } from "../../shared/db/models/Counter";
import {
  ICounter,
  ICounterMuzzle
} from "../../shared/models/counter/counter-models";
import { getRemainingTime } from "../muzzle/muzzle-utilities";
import { MuzzlePersistenceService } from "../muzzle/muzzle.persistence.service";
import { WebService } from "../web/web.service";
import { COUNTER_TIME } from "./constants";

export class CounterPersistenceService {
  public static getInstance() {
    if (!CounterPersistenceService.instance) {
      CounterPersistenceService.instance = new CounterPersistenceService();
    }
    return CounterPersistenceService.instance;
  }

  private static instance: CounterPersistenceService;
  private muzzlePersistenceService: MuzzlePersistenceService = MuzzlePersistenceService.getInstance();
  private webService: WebService = WebService.getInstance();
  private counters: Map<number, ICounter> = new Map();
  private counterMuzzles: Map<string, ICounterMuzzle> = new Map();

  private constructor() {}

  public addCounter(requestorId: string, counteredUserId: string) {
    return new Promise(async (resolve, reject) => {
      const counter = new Counter();
      counter.requestorId = requestorId;
      counter.counteredId = counteredUserId;
      counter.countered = false;

      await getRepository(Counter)
        .save(counter)
        .then(counterFromDb => {
          this.setCounterState(requestorId, counteredUserId, counterFromDb.id);
          resolve();
        })
        .catch(e => reject(`Error on saving counter to DB: ${e}`));
    });
  }

  public addCounterMuzzleTime(userId: string, timeToAdd: number) {
    if (userId && this.counterMuzzles.has(userId)) {
      const removalFn = this.counterMuzzles.get(userId)!.removalFn;
      const newTime = getRemainingTime(removalFn) + timeToAdd;
      clearTimeout(this.counterMuzzles.get(userId)!.removalFn);
      console.log(`Setting ${userId}'s muzzle time to ${newTime}`);
      this.counterMuzzles.set(userId, {
        suppressionCount: this.counterMuzzles.get(userId)!.suppressionCount,
        counterId: this.counterMuzzles.get(userId)!.counterId,
        removalFn: setTimeout(() => this.removeCounterMuzzle(userId), newTime)
      });
    }
  }

  public setCounterMuzzle(userId: string, options: ICounterMuzzle) {
    this.counterMuzzles.set(userId, options);
  }

  public async setCounteredToTrue(id: number) {
    const counter = await getRepository(Counter).findOne(id);
    counter!.countered = true;
    return getRepository(Counter).save(counter as Counter);
  }

  public getCounter(counterId: number): ICounter | undefined {
    return this.counters.get(counterId);
  }

  public isCounterMuzzled(userId: string) {
    return this.counterMuzzles.has(userId);
  }

  public getCounterMuzzle(userId: string) {
    return this.counterMuzzles.get(userId);
  }

  public counterMuzzle(userId: string, counterId: number) {
    this.counterMuzzles.set(userId, {
      suppressionCount: 0,
      counterId,
      removalFn: setTimeout(
        () => this.removeCounterMuzzle(userId),
        COUNTER_TIME
      )
    });
  }

  /**
   * Retrieves the counterId for a counter that includes the specified requestorId and userId.
   */
  public getCounterByRequestorAndUserId(
    requestorId: string,
    userId: string
  ): number | undefined {
    let counterId;
    this.counters.forEach((item, key) => {
      if (item.requestorId === requestorId && item.counteredId === userId) {
        counterId = key;
      }
    });

    return counterId;
  }

  public async removeCounter(id: number, isUsed: boolean, channel?: string) {
    const counter = this.counters.get(id);

    if (isUsed && channel) {
      clearTimeout(counter!.removalFn);
      this.counters.delete(id);
      await this.setCounteredToTrue(id).catch(e =>
        console.error("Error during setCounteredToTrue", e)
      );
    } else {
      // This whole section is an anti-pattern. Fix this.
      this.counters.delete(id);
      this.counterMuzzle(counter!.requestorId, id);
      this.muzzlePersistenceService.removeMuzzlePrivileges(
        counter!.requestorId
      );
      this.webService.sendMessage(
        "#general",
        `:flesh: <@${counter!.requestorId}> lives in fear of <@${
          counter!.counteredId
        }> and is now muzzled and has lost muzzle privileges for one hour. :flesh:`
      );
    }
  }

  private removeCounterMuzzle(userId: string) {
    this.counterMuzzles.delete(userId);
  }

  private setCounterState(
    requestorId: string,
    userId: string,
    counterId: number
  ) {
    this.counters.set(counterId, {
      requestorId,
      counteredId: userId,
      removalFn: setTimeout(
        () => this.removeCounter(counterId, false, "#general"),
        COUNTER_TIME
      )
    });
  }
}
