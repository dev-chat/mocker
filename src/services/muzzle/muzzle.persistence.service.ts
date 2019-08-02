import moment from "moment";
import { getRepository } from "typeorm";
import { Muzzle } from "../../shared/db/models/Muzzle";
import {
  IReportRange,
  ReportType
} from "../../shared/models/muzzle/muzzle-models";

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
  public async retrieveMuzzleReport(
    reportType: ReportType = ReportType.AllTime
  ) {
    const range: IReportRange = this.getRange(reportType);

    const mostMuzzledByInstances = await this.getMostMuzzledByInstances(range);
    const mostMuzzledByMessages = await this.getMostMuzzledByMessages(range);
    const mostMuzzledByWords = await this.getMostMuzzledByWords(range);
    const mostMuzzledByChars = await this.getMostMuzzledByChars(range);
    const mostMuzzledByTime = await this.getMostMuzzledByTime(range);

    const muzzlerByInstances = await this.getMuzzlerByInstances(range);
    const muzzlerByMessages = await this.getMuzzlerByMessages(range);
    const muzzlerByWords = await this.getMuzzlerByWords(range);
    const muzzlerByChars = await this.getMuzzlerByChars(range);
    const muzzlerByTime = await this.getMuzzlerByTime(range);

    const accuracy = await this.getAccuracy(range);
    const kdr = await this.getKdr(range);

    const rawNemesis = await this.getNemesisByRaw(range);
    const successNemesis = await this.getNemesisBySuccessful(range);

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
      rawNemesis,
      successNemesis
    };
  }

  private getRange(reportType: ReportType) {
    const range: IReportRange = {
      reportType
    };
    if (reportType === ReportType.AllTime) {
      range.reportType = ReportType.AllTime;
    } else if (reportType === ReportType.Day) {
      range.start = moment()
        .startOf("day")
        .format("YYYY-MM-DD HH:mm:ss");
      range.end = moment()
        .endOf("day")
        .format("YYYY-MM-DD HH:mm:ss");
    } else if (reportType === ReportType.Week) {
      range.start = moment()
        .startOf("week")
        .format("YYYY-MM-DD HH:mm:ss");
      range.end = moment()
        .endOf("week")
        .format("YYYY-MM-DD HH:mm:ss");
    } else if (reportType === ReportType.Month) {
      range.start = moment()
        .startOf("month")
        .format("YYYY-MM-DD HH:mm:ss");
      range.end = moment()
        .endOf("month")
        .format("YYYY-MM-DD HH:mm:ss");
    } else if (reportType === ReportType.Year) {
      range.start = moment()
        .startOf("year")
        .format("YYYY-MM-DD HH:mm:ss");
      range.end = moment()
        .endOf("year")
        .format("YYYY-MM-DD HH:mm:ss");
    }

    return range;
  }

  private getMostMuzzledByInstances(range: IReportRange) {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT muzzledId, COUNT(*) as count FROM muzzle GROUP BY muzzledId ORDER BY count DESC;`
        : `SELECT muzzledId, COUNT(*) as count WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${
            range.end
          }' FROM muzzle GROUP BY muzzledId ORDER BY count DESC`;

    return getRepository(Muzzle).query(query);
  }

  private getMuzzlerByInstances(range: IReportRange) {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT requestorId, COUNT(*) as instanceCount FROM muzzle GROUP BY requestorId ORDER BY instanceCount DESC;`
        : `SELECT requestorId, COUNT(*) as instanceCount WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${
            range.end
          }' FROM muzzle GROUP BY requestorId ORDER BY instanceCount DESC`;

    return getRepository(Muzzle).query(query);
  }

  private getMuzzlerByMessages(range: IReportRange) {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT requestorId, SUM(messagesSuppressed) as messagesSuppressed FROM muzzle GROUP BY requestorId ORDER BY messagesSuppressed DESC;`
        : `SELECT requestorId, SUM(messagesSuppressed) as messagesSuppressed WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${
            range.end
          }' FROM muzzle GROUP BY requestorId ORDER BY messagesSuppressed DESC`;

    return getRepository(Muzzle).query(query);
  }

  private getMostMuzzledByMessages(range: IReportRange) {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT muzzledId, SUM(messagesSuppressed) as messagesSuppressed FROM muzzle GROUP BY muzzledId ORDER BY messagesSuppressed DESC;`
        : `SELECT muzzledId, SUM(messagesSuppressed) as messagesSuppressed WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${
            range.end
          }' FROM muzzle GROUP BY muzzledId ORDER BY messagesSuppressed DESC`;

    return getRepository(Muzzle).query(query);
  }

  private getMostMuzzledByWords(range: IReportRange) {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT muzzledId, SUM(wordsSuppressed) as wordsSuppressed FROM muzzle GROUP BY muzzledId ORDER BY wordsSuppressed DESC;`
        : `SELECT muzzledId, SUM(wordsSuppressed) as wordsSuppressed WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${
            range.end
          }' FROM muzzle GROUP BY muzzledId ORDER BY wordsSuppressed DESC`;

    return getRepository(Muzzle).query(query);
  }

  private getMuzzlerByWords(range: IReportRange) {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT requestorId, SUM(wordsSuppressed) as wordsSuppressed FROM muzzle GROUP BY requestorId ORDER BY wordsSuppressed DESC;`
        : `SELECT requestorId, SUM(wordsSuppressed) as wordsSuppressed WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${
            range.end
          }' FROM muzzle GROUP BY requestorId ORDER BY wordsSuppressed DESC`;

    return getRepository(Muzzle).query(query);
  }

  private getMostMuzzledByChars(range: IReportRange) {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT muzzledId, SUM(charactersSuppressed) as charactersSuppressed FROM muzzle GROUP BY muzzledId ORDER BY charactersSuppressed DESC;`
        : `SELECT muzzledId, SUM(charactersSuppressed) as charactersSuppressed WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${
            range.end
          }' FROM muzzle GROUP BY muzzledId ORDER BY charactersSuppressed DESC`;

    return getRepository(Muzzle).query(query);
  }

  private getMuzzlerByChars(range: IReportRange) {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT requestorId, SUM(charactersSuppressed) as charactersSuppressed FROM muzzle GROUP BY requestorId ORDER BY charactersSuppressed DESC;`
        : `SELECT requestorId, SUM(charactersSuppressed) as charactersSuppressed WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${
            range.end
          }' FROM muzzle GROUP BY requestorId ORDER BY charactersSuppressed DESC`;

    return getRepository(Muzzle).query(query);
  }

  private getMostMuzzledByTime(range: IReportRange) {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT muzzledId, SUM(milliseconds) as muzzleTime FROM muzzle GROUP BY muzzledId ORDER BY muzzleTime DESC;`
        : `SELECT muzzledId, SUM(milliseconds) as muzzleTime WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${
            range.end
          }' FROM muzzle GROUP BY muzzledId ORDER BY muzzleTime DESC`;

    return getRepository(Muzzle).query(query);
  }

  private getMuzzlerByTime(range: IReportRange) {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT requestorId, SUM(milliseconds) as muzzleTime FROM muzzle GROUP BY requestorId ORDER BY muzzleTime DESC;`
        : `SELECT requestorId, SUM(milliseconds) as muzzleTime WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${
            range.end
          }' FROM muzzle GROUP BY requestorId ORDER BY muzzleTime DESC`;

    return getRepository(Muzzle).query(query);
  }

  private getAccuracy(range: IReportRange) {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT requestorId, SUM(IF(messagesSuppressed > 0, 1, 0))/COUNT(*) as accuracy, SUM(IF(muzzle.messagesSuppressed > 0, 1, 0)) as kills, COUNT(*) as deaths
           FROM muzzle GROUP BY requestorId ORDER BY accuracy DESC;`
        : `SELECT requestorId, SUM(IF(messagesSuppressed > 0, 1, 0))/COUNT(*) as accuracy, SUM(IF(muzzle.messagesSuppressed > 0, 1, 0)) as kills, COUNT(*) as deaths
        WHERE createdAt >= '${range.start}' AND createdAt < '${
            range.end
          }' FROM muzzle GROUP BY requestorId ORDER BY accuracy DESC`;

    return getRepository(Muzzle).query(query);
  }

  private getKdr(range: IReportRange) {
    const query =
      range.reportType === ReportType.AllTime
        ? `
        SELECT b.requestorId, a.count AS deaths, b.count as kills, b.count/a.count as kdr
        FROM (SELECT muzzledId, COUNT(*) as count FROM muzzle WHERE messagesSuppressed > 0 GROUP BY muzzledId) as a
        INNER JOIN (
        SELECT requestorId, COUNT(*) as count
        FROM muzzle
        GROUP BY requestorId
        ) AS b
        ON a.muzzledId = b.requestorId
        GROUP BY b.requestorId, a.count, b.count, kdr
        ORDER BY kdr DESC;
        `
        : `
        SELECT b.requestorId, a.count AS deaths, b.count as kills, b.count/a.count as kdr
        FROM (SELECT muzzledId, COUNT(*) as count FROM muzzle WHERE messagesSuppressed > 0 GROUP BY muzzledId) as a
        INNER JOIN (
        SELECT requestorId, COUNT(*) as count
        FROM muzzle
        WHERE messagesSuppressed > 0 AND createdAt >= '${
          range.start
        }' AND createdAt < '${range.end}'
        GROUP BY requestorId
        ) AS b
        ON a.muzzledId = b.requestorId
        GROUP BY b.requestorId, a.count, b.count, kdr
        ORDER BY kdr DESC;
        `;

    return getRepository(Muzzle).query(query);
  }

  private getNemesisByRaw(range: IReportRange) {
    const query =
      range.reportType === ReportType.AllTime
        ? `
    SELECT a.requestorId, a.muzzledId, MAX(a.count) as killCount
    FROM (
      SELECT requestorId, muzzledId, COUNT(*) as count
      FROM muzzle
      GROUP BY requestorId, muzzledId
    ) AS a 
    INNER JOIN(
      SELECT muzzledId, MAX(count) AS count
      FROM (
        SELECT requestorId, muzzledId, COUNT(*) AS count 
        FROM muzzle
        GROUP BY requestorId, muzzledId
      ) AS c 
      GROUP BY c.muzzledId
    ) AS b 
    ON a.muzzledId = b.muzzledId AND a.count = b.count
    GROUP BY a.requestorId, a.muzzledId
    ORDER BY a.count DESC;`
        : `
    SELECT a.requestorId, a.muzzledId, MAX(a.count) as killCount
    FROM (
      SELECT requestorId, muzzledId, COUNT(*) as count
      FROM muzzle
      WHERE createdAt >= '${range.start}' AND createdAt < '${range.end}'
      GROUP BY requestorId, muzzledId
    ) AS a 
    INNER JOIN(
      SELECT muzzledId, MAX(count) AS count
      FROM (
        SELECT requestorId, muzzledId, COUNT(*) AS count 
        FROM muzzle
        WHERE createdAt >= '${range.start}' AND createdAt < '${range.end}'
        GROUP BY requestorId, muzzledId
      ) AS c 
      GROUP BY c.muzzledId
    ) AS b 
    ON a.muzzledId = b.muzzledId AND a.count = b.count
    GROUP BY a.requestorId, a.muzzledId
    ORDER BY a.count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  private getNemesisBySuccessful(range: IReportRange) {
    const query =
      range.reportType === ReportType.AllTime
        ? `
      SELECT a.requestorId, a.muzzledId, MAX(a.count) as killCount
      FROM (
        SELECT requestorId, muzzledId, COUNT(*) as count
        FROM muzzle
        WHERE messagesSuppressed > 0
        GROUP BY requestorId, muzzledId
      ) AS a 
      INNER JOIN(
        SELECT muzzledId, MAX(count) AS count
        FROM (
          SELECT requestorId, muzzledId, COUNT(*) AS count 
          FROM muzzle
          WHERE messagesSuppressed > 0
          GROUP BY requestorId, muzzledId
        ) AS c 
        GROUP BY c.muzzledId
      ) AS b 
      ON a.muzzledId = b.muzzledId AND a.count = b.count
      GROUP BY a.requestorId, a.muzzledId
      ORDER BY a.count DESC;`
        : `
      SELECT a.requestorId, a.muzzledId, MAX(a.count) as killCount
      FROM (
        SELECT requestorId, muzzledId, COUNT(*) as count
        FROM muzzle
        WHERE createdAt >= '${range.start}' AND createdAt < '${
            range.end
          }' AND messagesSuppressed > 0
        GROUP BY requestorId, muzzledId
      ) AS a 
      INNER JOIN(
        SELECT muzzledId, MAX(count) AS count
        FROM (
          SELECT requestorId, muzzledId, COUNT(*) AS count 
          FROM muzzle
          WHERE createdAt >= '${range.start}' AND createdAt < '${
            range.end
          }'  AND messagesSuppressed > 0
          GROUP BY requestorId, muzzledId
        ) AS c 
        GROUP BY c.muzzledId
      ) AS b 
      ON a.muzzledId = b.muzzledId AND a.count = b.count
      GROUP BY a.requestorId, a.muzzledId
      ORDER BY a.count DESC;`;

    return getRepository(Muzzle).query(query);
  }
}
