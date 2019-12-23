import { getRepository } from "typeorm";
import { Backfire } from "../../shared/db/models/Backfire";
import { IBackfire } from "../../shared/models/backfire/backfire.model";
import { ABUSE_PENALTY_TIME } from "../muzzle/constants";
import { getRemainingTime } from "../muzzle/muzzle-utilities";

export class BackFirePersistenceService {
  public static getInstance() {
    if (!BackFirePersistenceService.instance) {
      BackFirePersistenceService.instance = new BackFirePersistenceService();
    }
    return BackFirePersistenceService.instance;
  }

  private static instance: BackFirePersistenceService;
  private backfires: Map<string, IBackfire> = new Map();

  private constructor() {}

  public addBackfire(userId: string, time: number) {
    const backfire = new Backfire();
    backfire.muzzledId = userId;
    backfire.messagesSuppressed = 0;
    backfire.wordsSuppressed = 0;
    backfire.charactersSuppressed = 0;
    backfire.milliseconds = time;

    return getRepository(Backfire)
      .save(backfire)
      .then(backfireFromDb => {
        this.backfires.set(userId, {
          suppressionCount: 0,
          id: backfireFromDb.id,
          removalFn: setTimeout(() => this.removeBackfire(userId), time)
        });
      });
  }

  public removeBackfire(userId: string) {
    this.backfires.delete(userId);
    console.log(`Backfire has expired and been removed for ${userId}`);
  }

  public isBackfire(userId: string): boolean {
    return this.backfires.has(userId);
  }

  public addBackfireTime(userId: string, timeToAdd: number) {
    if (userId && this.backfires.has(userId)) {
      const removalFn = this.backfires.get(userId)!.removalFn;
      const newTime = getRemainingTime(removalFn) + timeToAdd;
      const backfireId = this.backfires.get(userId)!.id;
      this.incrementBackfireTime(backfireId, ABUSE_PENALTY_TIME);
      clearTimeout(this.backfires.get(userId)!.removalFn);
      console.log(`Setting ${userId}'s backfire time to ${newTime}`);
      this.backfires.set(userId, {
        suppressionCount: this.backfires.get(userId)!.suppressionCount,
        id: this.backfires.get(userId)!.id,
        removalFn: setTimeout(() => this.removeBackfire(userId), newTime)
      });
    }
  }

  public getBackfireByUserId(userId: string): IBackfire | undefined {
    return this.backfires.get(userId);
  }

  public setBackfire(userId: string, options: IBackfire) {
    this.backfires.set(userId, options);
  }

  /**
   * Determines suppression counts for messages that are ONLY deleted.
   * Used when a backfired user has hit their max suppressions or when they have tagged channel.
   */
  public trackDeletedMessage(backfireId: number, text: string) {
    const words = text.split(" ").length;
    const characters = text.split("").length;
    this.incrementMessageSuppressions(backfireId);
    this.incrementWordSuppressions(backfireId, words);
    this.incrementCharacterSuppressions(backfireId, characters);
  }

  public incrementBackfireTime(id: number, ms: number) {
    return getRepository(Backfire).increment({ id }, "milliseconds", ms);
  }

  public incrementMessageSuppressions(id: number) {
    return getRepository(Backfire).increment({ id }, "messagesSuppressed", 1);
  }

  public incrementWordSuppressions(id: number, suppressions: number) {
    return getRepository(Backfire).increment(
      { id },
      "wordsSuppressed",
      suppressions
    );
  }

  public incrementCharacterSuppressions(
    id: number,
    charactersSuppressed: number
  ) {
    return getRepository(Backfire).increment(
      { id },
      "charactersSuppressed",
      charactersSuppressed
    );
  }
}
