import Table from "easy-table";
import { getRepository } from "typeorm";
import { Muzzle } from "../../shared/db/models/Muzzle";
import { IAttachment } from "../../shared/models/slack/slack-models";
import { SlackService } from "../slack/slack.service";

export class MuzzlePersistenceService {
  public static getInstance() {
    if (!MuzzlePersistenceService.instance) {
      MuzzlePersistenceService.instance = new MuzzlePersistenceService();
      MuzzlePersistenceService.slackService = SlackService.getInstance();
    }
    return MuzzlePersistenceService.instance;
  }

  private static instance: MuzzlePersistenceService;
  private static slackService: SlackService;

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
      kdr,
      nemesis
    };
  }

  public generateFormattedReport(report: any): IAttachment[] {
    const formattedReport = this.formatReport(report);
    const topMuzzledByInstances = {
      pretext: "*Top Muzzled by Times Muzzled*",
      text: `\`\`\`${Table.print(formattedReport.muzzled.byInstances)}\`\`\``,
      mrkdwn_in: ["text", "pretext"]
    };

    const topMuzzlersByInstances = {
      pretext: "*Top Muzzlers*",
      text: `\`\`\`${Table.print(formattedReport.muzzlers.byInstances)}\`\`\``,
      mrkdwn_in: ["text", "pretext"]
    };

    const topKdr = {
      pretext: "*Top KDR*",
      text: `\`\`\`${Table.print(formattedReport.KDR)}\`\`\``,
      mrkdwn_in: ["text", "pretext"]
    };

    const nemesis = {
      pretext: "*Top Nemesis*",
      text: `\`\`\`${Table.print(formattedReport.nemesis)}\`\`\``,
      mrkdwn_in: ["text", "pretext"]
    };

    const attachments = [
      topMuzzledByInstances,
      topMuzzlersByInstances,
      topKdr,
      nemesis
    ];

    return attachments;
  }

  private formatReport(report: any) {
    const reportFormatted = {
      muzzled: {
        byInstances: report.muzzled.byInstances.map((instance: any) => {
          return {
            user: MuzzlePersistenceService.slackService.getUserById(
              instance.muzzledId
            )!.name,
            timeMuzzled: instance.count
          };
        })
      },
      muzzlers: {
        byInstances: report.muzzlers.byInstances.map((instance: any) => {
          return {
            muzzler: MuzzlePersistenceService.slackService.getUserById(
              instance.muzzle_requestorId
            )!.name,
            muzzlesIssued: instance.instanceCount
          };
        })
      },
      KDR: report.kdr.map((instance: any) => {
        return {
          muzzler: MuzzlePersistenceService.slackService.getUserById(
            instance.muzzle_requestorId
          )!.name,
          kdr: instance.kdr,
          successfulMuzzles: instance.kills,
          totalMuzzles: instance.deaths
        };
      }),
      nemesis: report.nemesis.map((instance: any) => {
        return {
          muzzler: MuzzlePersistenceService.slackService.getUserById(
            instance.requestorId
          )!.name,
          muzzled: MuzzlePersistenceService.slackService.getUserById(
            instance.muzzledId
          )!.name,
          timesMuzzled: instance.killCount
        };
      })
    };

    return reportFormatted;
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

    return getRepository(Muzzle)
      .createQueryBuilder("muzzle")
      .select("muzzle.requestorId")
      .addSelect("SUM(IF(muzzle.messagesSuppressed > 0, 1, 0))/COUNT(*)", "kdr")
      .addSelect("SUM(IF(muzzle.messagesSuppressed > 0, 1, 0))", "kills")
      .addSelect("COUNT(*)", "deaths")
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
