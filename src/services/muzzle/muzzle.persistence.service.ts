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
  public async retrieveMuzzleReport() {
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

    const accuracy = await this.getAccuracy();
    const kdr = await this.getKdr();
    const nemesis = await this.getNemesis();

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
      accuracy,
      kdr,
      nemesis
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

  private getAccuracy(range?: string) {
    if (range) {
      console.log(range);
    }

    return getRepository(Muzzle)
      .createQueryBuilder("muzzle")
      .select("muzzle.requestorId")
      .addSelect(
        "SUM(IF(muzzle.messagesSuppressed > 0, 1, 0))/COUNT(*)",
        "accuracy"
      )
      .addSelect("SUM(IF(muzzle.messagesSuppressed > 0, 1, 0))", "kills")
      .addSelect("COUNT(*)", "deaths")
      .groupBy("muzzle.requestorId")
      .orderBy("accuracy", "DESC")
      .getRawMany();
  }

  private getKdr(range?: string) {
    if (range) {
      console.log(range);
    }

    return getRepository(Muzzle)
      .createQueryBuilder("muzzle")
      .select("muzzle.requestorId")
      .addSelect("SUM(IF(muzzle.messagesSuppressed > 0, 1, 0))", "kills")
      .addSelect("muzzle.muzzledId")
      .addSelect("COUNT(*)", "deaths")
      .addSelect("kills/deaths", "kdr")
      .groupBy("muzzle.requestorId")
      .orderBy("kdr", "DESC")
      .getRawMany();
  }

  private getNemesis(range?: string) {
    if (range) {
      console.log(range);
    }

    const getNemesisSqlQuery = `SELECT a.requestorId, a.muzzledId, MAX(a.count) as killCount
    FROM (SELECT requestorId, muzzledId, COUNT(*) as count FROM muzzle GROUP BY requestorId, muzzledId) AS a 
    INNER JOIN(SELECT muzzledId, MAX(count) AS count
    FROM (SELECT requestorId, muzzledId, COUNT(*) AS count FROM muzzle GROUP BY requestorId, muzzledId) AS c 
    GROUP BY c.muzzledId) AS b 
    ON a.muzzledId = b.muzzledId AND a.count = b.count
    GROUP BY a.requestorId, a.muzzledId
    ORDER BY a.count DESC;`;

    return getRepository(Muzzle).query(getNemesisSqlQuery);
  }
}
