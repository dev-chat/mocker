import { getRepository } from "typeorm";
import { Muzzle } from "../../shared/db/models/Muzzle";

export class MuzzlePersistenceService {
  public static getInstance() {
    if (!MuzzlePersistenceService.instance) {
      MuzzlePersistenceService.instance = new MuzzlePersistenceService();
    }
    return MuzzlePersistenceService.instance;
  }

  private static instance: MuzzlePersistenceService;
  private constructor() {}

  public addMuzzleToDb(requestorId: string, muzzledId: string, time: number) {
    const muzzle = new Muzzle();
    muzzle.requestorId = requestorId;
    muzzle.muzzledId = muzzledId;
    muzzle.messagesSuppressed = 0;
    muzzle.wordsSuppressed = 0;
    muzzle.charactersSuppressed = 0;
    muzzle.milliseconds = time;
    return getRepository(Muzzle).save(muzzle);
  }

  public incrementMuzzleTime(id: number, ms: number) {
    return getRepository(Muzzle).increment({ id }, "milliseconds", ms);
  }

  public incrementMessageSuppressions(id: number) {
    return getRepository(Muzzle).increment({ id }, "messagesSuppressed", 1);
  }

  public incrementWordSuppressions(id: number, suppressions: number) {
    return getRepository(Muzzle).increment(
      { id },
      "wordsSuppressed",
      suppressions
    );
  }

  public incrementCharacterSuppressions(
    id: number,
    charactersSuppressed: number
  ) {
    return getRepository(Muzzle).increment(
      { id },
      "charactersSuppressed",
      charactersSuppressed
    );
  }
  /**
   * Determines suppression counts for messages that are ONLY deleted and not muzzled.
   * Used when a muzzled user has hit their max suppressions or when they have tagged channel.
   */
  public trackDeletedMessage(muzzleId: number, text: string) {
    const words = text.split(" ").length;
    const characters = text.split("").length;
    this.incrementMessageSuppressions(muzzleId);
    this.incrementWordSuppressions(muzzleId, words);
    this.incrementCharacterSuppressions(muzzleId, characters);
  }

  /** Wrapper to generate a generic muzzle report in */
  public async retrieveWeeklyMuzzleReport() {
    const mostMuzzledByInstances = await this.getMostMuzzledByInstances();
    const mostMuzzledByWords = await this.getMostMuzzledByWords();
    return {
      byInstances: mostMuzzledByInstances,
      byWords: mostMuzzledByWords
    };
  }

  private getMostMuzzledByInstances(range?: string) {
    if (range) {
      console.log(range);
    }

    return getRepository(Muzzle)
      .createQueryBuilder("muzzle")
      .select("muzzle.muzzledId AS muzzleId")
      .addSelect("COUNT(*) as count")
      .groupBy("muzzle.muzzledId")
      .orderBy("count", "DESC")
      .getRawMany();
  }

  private getMostMuzzledByWords(range?: string) {
    if (range) {
      console.log(range);
    }

    return getRepository(Muzzle)
      .createQueryBuilder("muzzle")
      .select("muzzle.muzzledId AS muzzledId, muzzle.wordsSuppressed")
      .addSelect("COUNT(*) as count")
      .groupBy("muzzle.muzzledId")
      .orderBy("count", "DESC")
      .getRawMany();
  }
}
