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
    const mostMuzzledByMessages = await this.getMostMuzzledByMessages();
    const mostMuzzledByWords = await this.getMostMuzzledByWords();
    const mostMuzzledByChars = await this.getMostMuzzledByChars();
    const mostMuzzledByTime = await this.getMostMuzzledByTime();

    const muzzlerByInstances = await this.getMuzzlerByInstances();
    const muzzlerByMessages = await this.getMuzzlerByMessages();
    const muzzlerByWords = await this.getMuzzlerByWords();
    const muzzlerByChars = await this.getMuzzlerByChars();
    const muzzlerByTime = await this.getMuzzlerByTime();

    const kdr = await this.getKdr();
    return {
      muzzled: {
        byInstances: mostMuzzledByInstances,
        byMessages: mostMuzzledByMessages,
        byWords: mostMuzzledByWords,
        byChars: mostMuzzledByChars,
        byTime: mostMuzzledByTime
      },
      muzzlers: {
        byInstances: muzzlerByInstances,
        byMessages: muzzlerByMessages,
        byWords: muzzlerByWords,
        byChars: muzzlerByChars,
        byTime: muzzlerByTime
      },
      kdr,
      relationships: {}
    };
  }

  private getMostMuzzledByInstances(range?: string) {
    if (range) {
      console.log(range);
    }

    return getRepository(Muzzle)
      .createQueryBuilder("muzzle")
      .select("muzzle.muzzledId AS muzzledId")
      .addSelect("COUNT(*) as count")
      .groupBy("muzzle.muzzledId")
      .orderBy("count", "DESC")
      .getRawMany();
  }

  private getMuzzlerByInstances(range?: string) {
    if (range) {
      console.log(range);
    }

    return getRepository(Muzzle)
      .createQueryBuilder("muzzle")
      .select("muzzle.requestorId")
      .addSelect("COUNT(*)", "instanceCount")
      .groupBy("muzzle.requestorId")
      .orderBy("instanceCount", "DESC")
      .getRawMany();
  }

  private getMuzzlerByMessages(range?: string) {
    if (range) {
      console.log(range);
    }

    return getRepository(Muzzle)
      .createQueryBuilder("muzzle")
      .select("muzzle.requestorId")
      .addSelect("SUM(muzzle.messagesSuppressed)", "messagesSuppressed")
      .groupBy("muzzle.requestorId")
      .orderBy("messagesSuppressed", "DESC")
      .getRawMany();
  }

  private getMostMuzzledByMessages(range?: string) {
    if (range) {
      console.log(range);
    }

    return getRepository(Muzzle)
      .createQueryBuilder("muzzle")
      .select("muzzle.muzzledId", "muzzledId")
      .addSelect("SUM(muzzle.messagesSuppressed)", "messagesSuppressed")
      .groupBy("muzzledId")
      .orderBy("messagesSuppressed", "DESC")
      .getRawMany();
  }

  private getMostMuzzledByWords(range?: string) {
    if (range) {
      console.log(range);
    }

    return getRepository(Muzzle)
      .createQueryBuilder("muzzle")
      .select("muzzle.muzzledId")
      .addSelect("SUM(muzzle.wordsSuppressed)", "totalWordsSuppressed")
      .groupBy("muzzle.muzzledId")
      .orderBy("totalWordsSuppressed", "DESC")
      .getRawMany();
  }

  private getMuzzlerByWords(range?: string) {
    if (range) {
      console.log(range);
    }

    return getRepository(Muzzle)
      .createQueryBuilder("muzzle")
      .select("muzzle.requestorId")
      .addSelect("SUM(muzzle.wordsSuppressed)", "totalWordsSuppressed")
      .groupBy("muzzle.requestorId")
      .orderBy("totalWordsSuppressed", "DESC")
      .getRawMany();
  }

  private getMostMuzzledByChars(range?: string) {
    if (range) {
      console.log(range);
    }

    return getRepository(Muzzle)
      .createQueryBuilder("muzzle")
      .select("muzzle.muzzledId")
      .addSelect("SUM(muzzle.charactersSuppressed)", "totalCharsSuppressed")
      .groupBy("muzzle.muzzledId")
      .orderBy("totalCharsSuppressed", "DESC")
      .getRawMany();
  }

  private getMuzzlerByChars(range?: string) {
    if (range) {
      console.log(range);
    }

    return getRepository(Muzzle)
      .createQueryBuilder("muzzle")
      .select("muzzle.requestorId")
      .addSelect("SUM(muzzle.charactersSuppressed)", "totalCharsSuppressed")
      .groupBy("muzzle.requestorId")
      .orderBy("totalCharsSuppressed", "DESC")
      .getRawMany();
  }

  private getMostMuzzledByTime(range?: string) {
    if (range) {
      console.log(range);
    }
    return getRepository(Muzzle)
      .createQueryBuilder("muzzle")
      .select("muzzle.muzzledId")
      .addSelect("SUM(muzzle.milliseconds)", "muzzleTime")
      .groupBy("muzzle.muzzledId")
      .orderBy("muzzleTime", "DESC")
      .getRawMany();
  }

  private getMuzzlerByTime(range?: string) {
    if (range) {
      console.log(range);
    }
    return getRepository(Muzzle)
      .createQueryBuilder("muzzle")
      .select("muzzle.requestorId")
      .addSelect("SUM(muzzle.milliseconds)", "muzzleTime")
      .groupBy("muzzle.requestorId")
      .orderBy("muzzleTime", "DESC")
      .getRawMany();
  }

  private getKdr(range?: string) {
    if (range) {
      console.log(range);
    }

    return (
      getRepository(Muzzle)
        .createQueryBuilder("muzzle")
        .select("muzzle.requestorId")
        // .addSelect(
        //   "CAST((COUNT(muzzle.messagesSuppressed > 0) / COUNT(*)) AS DECIMAL(4,3))",
        //   "kdr"
        // )
        .addSelect("COUNT(muzzle.messagesSuppressed > 0)", "kdr")
        .addSelect("COUNT(*)", "total")
        .groupBy("muzzle.requestorId")
        .orderBy("kdr", "DESC")
        .getRawMany()
    );
  }
}
