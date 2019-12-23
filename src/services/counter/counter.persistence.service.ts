import { getRepository } from "typeorm";
import { Counter } from "../../shared/db/models/Counter";
import { ICounter } from "../../shared/models/counter/counter-models";
import { COUNTER_TIME } from "./constants";

export class CounterPersistenceService {
  public static getInstance() {
    if (!CounterPersistenceService.instance) {
      CounterPersistenceService.instance = new CounterPersistenceService();
    }
    return CounterPersistenceService.instance;
  }

  private static instance: CounterPersistenceService;
  private counters: Map<number, ICounter> = new Map();

  private constructor() {}

  public addCounter(
    requestorId: string,
    counteredUserId: string,
    isSuccessful: boolean
  ) {
    return new Promise(async (resolve, reject) => {
      const counter = new Counter();
      counter.requestorId = requestorId;
      counter.counteredId = counteredUserId;
      counter.countered = isSuccessful;

      await getRepository(Counter)
        .save(counter)
        .then(counterFromDb => {
          this.setCounterState(requestorId, counteredUserId, counterFromDb.id);
          resolve();
        })
        .catch(e => reject(`Error on saving counter to DB: ${e}`));
    });
  }

  public async setCounteredToTrue(id: number) {
    const counter = await getRepository(Counter).findOne(id);
    counter!.countered = true;
    return getRepository(Counter).save(counter as Counter);
  }

  public getCounter(counterId: number): ICounter | undefined {
    return this.counters.get(counterId);
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
      this.counters.delete(id);
    }
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
        () => this.removeCounter(counterId, false),
        COUNTER_TIME
      )
    });
  }
}
