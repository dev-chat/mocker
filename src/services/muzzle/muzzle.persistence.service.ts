import moment from 'moment';
import { UpdateResult, getRepository, getManager } from 'typeorm';
import { Muzzle } from '../../shared/db/models/Muzzle';
import { ABUSE_PENALTY_TIME, MAX_MUZZLES, MAX_TIME_BETWEEN_MUZZLES } from './constants';
import { Accuracy, MuzzleReport, ReportCount, ReportRange, ReportType } from '../../shared/models/report/report.model';
import { RedisPersistenceService } from '../../shared/db/redis.persistence.service';

export class MuzzlePersistenceService {
  public static getInstance(): MuzzlePersistenceService {
    if (!MuzzlePersistenceService.instance) {
      MuzzlePersistenceService.instance = new MuzzlePersistenceService();
    }
    return MuzzlePersistenceService.instance;
  }

  private static instance: MuzzlePersistenceService;
  private redis: RedisPersistenceService = RedisPersistenceService.getInstance();

  public addMuzzle(requestorId: string, muzzledId: string, time: number): Promise<Muzzle> {
    return new Promise(async (resolve, reject) => {
      const muzzle = new Muzzle();
      muzzle.requestorId = requestorId;
      muzzle.muzzledId = muzzledId;
      muzzle.messagesSuppressed = 0;
      muzzle.wordsSuppressed = 0;
      muzzle.charactersSuppressed = 0;
      muzzle.milliseconds = time;
      await getRepository(Muzzle)
        .save(muzzle)
        .then(muzzleFromDb => {
          this.redis.setValue(`muzzle.muzzled.${muzzledId}`, muzzleFromDb.id.toString(), 'EX', time / 1000);
          this.redis.setValue(`muzzle.muzzled.${muzzledId}.suppressions`, '0', 'EX', time / 1000);
          this.redis.setValue(`muzzle.muzzled.${muzzledId}.requestor`, requestorId, 'EX', time / 1000);
          this.setRequestorCount(requestorId);
          resolve();
        })
        .catch(e => reject(e));
    });
  }

  public removeMuzzlePrivileges(requestorId: string): void {
    this.redis.setValue(`muzzle.requestor.${requestorId}`, '2', 'EX', MAX_TIME_BETWEEN_MUZZLES);
  }

  public async setRequestorCount(requestorId: string): Promise<void> {
    const numberOfRequests: string | null = await this.redis.getValue(`muzzle.requestor.${requestorId}`);
    const requests: number = numberOfRequests ? +numberOfRequests : 0;
    const newNumber = requests + 1;
    if (!numberOfRequests) {
      this.redis.setValue(`muzzle.requestor.${requestorId}`, newNumber.toString(), 'EX', MAX_TIME_BETWEEN_MUZZLES);
    } else if (requests < MAX_MUZZLES) {
      this.redis.setValue(`muzzle.requestor.${requestorId}`, newNumber.toString());
    }
  }

  /**
   * Returns boolean whether max muzzles have been reached.
   */
  public async isMaxMuzzlesReached(userId: string): Promise<boolean> {
    const muzzles: string | null = await this.redis.getValue(`muzzle.requestor.${userId}`);
    return !!(muzzles && +muzzles === MAX_MUZZLES);
  }

  /**
   * Adds the specified amount of time to a specified muzzled user.
   */
  public async addMuzzleTime(userId: string, timeToAdd: number): Promise<void> {
    const muzzledId: string | null = await this.redis.getValue(`muzzle.muzzled.${userId}`);
    if (muzzledId) {
      const remainingTime: number = await this.redis.getTimeRemaining(`muzzle.muzzled.${userId}`);
      const newTime = remainingTime + timeToAdd / 1000;
      this.incrementMuzzleTime(+muzzledId, ABUSE_PENALTY_TIME);
      console.log(`Setting ${userId}'s muzzle time to ${newTime}`);
      this.redis.expire(`muzzle.muzzled.${userId}`, newTime);
    }
  }

  public async getMuzzle(userId: string): Promise<string | null> {
    return await this.redis.getValue(`muzzle.muzzled.${userId}`);
  }

  public async getSuppressions(userId: string): Promise<string | null> {
    return await this.redis.getValue(`muzzle.muzzled.${userId}.suppressions`);
  }

  public async incrementStatefulSuppressions(userId: string): Promise<void> {
    const suppressions = await this.redis.getValue(`muzzle.muzzled.${userId}.suppressions`);
    if (suppressions) {
      const newValue = +suppressions + 1;
      await this.redis.setValue(`muzzle.muzzled.${userId}.suppressions`, newValue.toString());
    } else {
      await this.redis.setValue(`muzzle.muzzled.${userId}.suppressions`, '1');
    }
  }

  /**
   * Returns boolean whether user is muzzled or not.
   */
  public async isUserMuzzled(userId: string): Promise<boolean> {
    return !!(await this.redis.getValue(`muzzle.muzzled.${userId}`));
  }

  public incrementMuzzleTime(id: number, ms: number): Promise<UpdateResult> {
    return getRepository(Muzzle).increment({ id }, 'milliseconds', ms);
  }

  public incrementMessageSuppressions(id: number): Promise<UpdateResult> {
    return getRepository(Muzzle).increment({ id }, 'messagesSuppressed', 1);
  }

  public incrementWordSuppressions(id: number, suppressions: number): Promise<UpdateResult> {
    return getRepository(Muzzle).increment({ id }, 'wordsSuppressed', suppressions);
  }

  public getRange(reportType: ReportType): ReportRange {
    const range: ReportRange = {
      reportType,
    };

    if (reportType === ReportType.AllTime) {
      range.reportType = ReportType.AllTime;
    } else if (reportType === ReportType.Week) {
      range.start = moment()
        .startOf('week')
        .subtract(1, 'week')
        .format('YYYY-MM-DD HH:mm:ss');
      range.end = moment()
        .endOf('week')
        .subtract(1, 'week')
        .format('YYYY-MM-DD HH:mm:ss');
    } else if (reportType === ReportType.Month) {
      range.start = moment()
        .startOf('month')
        .subtract(1, 'month')
        .format('YYYY-MM-DD HH:mm:ss');
      range.end = moment()
        .endOf('month')
        .subtract(1, 'month')
        .format('YYYY-MM-DD HH:mm:ss');
    } else if (reportType === ReportType.Trailing30) {
      range.start = moment()
        .startOf('day')
        .subtract(30, 'days')
        .format('YYYY-MM-DD HH:mm:ss');
      range.end = moment().format('YYYY-MM-DD HH:mm:ss');
    } else if (reportType === ReportType.Trailing7) {
      range.start = moment()
        .startOf('day')
        .subtract(7, 'days')
        .format('YYYY-MM-DD HH:mm:ss');
      range.end = moment().format('YYYY-MM-DD HH:mm:ss');
    } else if (reportType === ReportType.Year) {
      range.start = moment()
        .startOf('year')
        .format('YYYY-MM-DD HH:mm:ss');
      range.end = moment()
        .endOf('year')
        .format('YYYY-MM-DD HH:mm:ss');
    }

    return range;
  }

  public incrementCharacterSuppressions(id: number, charactersSuppressed: number): Promise<UpdateResult> {
    return getRepository(Muzzle).increment({ id }, 'charactersSuppressed', charactersSuppressed);
  }
  /**
   * Determines suppression counts for messages that are ONLY deleted and not muzzled.
   * Used when a muzzled user has hit their max suppressions or when they have tagged channel.
   */
  public trackDeletedMessage(muzzleId: number, text: string): void {
    const words = text.split(' ').length;
    const characters = text.split('').length;
    this.incrementMessageSuppressions(muzzleId);
    this.incrementWordSuppressions(muzzleId, words);
    this.incrementCharacterSuppressions(muzzleId, characters);
  }

  /** Wrapper to generate a generic muzzle report in */
  public async retrieveMuzzleReport(reportType: ReportType = ReportType.AllTime): Promise<MuzzleReport> {
    const range: ReportRange = this.getRange(reportType);

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
    const backfires = await this.getBackfireData(range);

    return {
      muzzled: {
        byInstances: mostMuzzledByInstances,
        byMessages: mostMuzzledByMessages,
        byWords: mostMuzzledByWords,
        byChars: mostMuzzledByChars,
        byTime: mostMuzzledByTime,
      },
      muzzlers: {
        byInstances: muzzlerByInstances,
        byMessages: muzzlerByMessages,
        byWords: muzzlerByWords,
        byChars: muzzlerByChars,
        byTime: muzzlerByTime,
      },
      accuracy,
      kdr,
      rawNemesis,
      successNemesis,
      backfires,
    };
  }

  private getMostMuzzledByInstances(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT muzzledId as slackId, COUNT(*) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT muzzledId as slackId, COUNT(*) as count FROM muzzle WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  private getMuzzlerByInstances(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT requestorId as slackId, COUNT(*) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT requestorId as slackId, COUNT(*) as count FROM muzzle WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  private getMuzzlerByMessages(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT requestorId as slackId, SUM(messagesSuppressed) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT requestorId as slackId, SUM(messagesSuppressed) as count FROM muzzle WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  private getMostMuzzledByMessages(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT muzzledId as slackId, SUM(messagesSuppressed) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT muzzledId as slackId, SUM(messagesSuppressed) as count FROM muzzle WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  private getMostMuzzledByWords(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT muzzledId as slackId, SUM(wordsSuppressed) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT muzzledId as slackId, SUM(wordsSuppressed) as count FROM muzzle WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  private getMuzzlerByWords(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT requestorId as slackId, SUM(wordsSuppressed) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT requestorId as slackId, SUM(wordsSuppressed) as count FROM muzzle WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  private getMostMuzzledByChars(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT muzzledId as slackId, SUM(charactersSuppressed) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT muzzledId as slackId, SUM(charactersSuppressed) as count FROM muzzle WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  private getMuzzlerByChars(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT requestorId as slackId, SUM(charactersSuppressed) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT requestorId as slackId, SUM(charactersSuppressed) as count FROM muzzle WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  private getMostMuzzledByTime(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT muzzledId as slackId, SUM(milliseconds) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT muzzledId as slackId, SUM(milliseconds) as count FROM muzzle WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  private getMuzzlerByTime(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT requestorId as slackId, SUM(milliseconds) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT requestorId as slackId, SUM(milliseconds) as count FROM muzzle WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  private getAccuracy(range: ReportRange): Promise<Accuracy[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT requestorId, SUM(IF(messagesSuppressed > 0, 1, 0))/COUNT(*) as accuracy, SUM(IF(muzzle.messagesSuppressed > 0, 1, 0)) as kills, COUNT(*) as deaths
           FROM muzzle GROUP BY requestorId ORDER BY accuracy DESC;`
        : `SELECT requestorId, SUM(IF(messagesSuppressed > 0, 1, 0))/COUNT(*) as accuracy, SUM(IF(muzzle.messagesSuppressed > 0, 1, 0)) as kills, COUNT(*) as deaths FROM muzzle WHERE createdAt >= '${
            range.start
          }' AND createdAt < '${range.end}' GROUP BY requestorId ORDER BY accuracy DESC;`;

    return getRepository(Muzzle).query(query);
  }

  private getKdr(range: ReportRange): Promise<any[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `
        SELECT b.requestorId, IF(a.count > 0, a.count, 0) AS deaths, b.count as kills, b.count/IF(a.count > 0, a.count, 1) as kdr
        FROM (SELECT muzzledId, COUNT(*) as count FROM muzzle WHERE messagesSuppressed > 0 GROUP BY muzzledId) as a
        RIGHT JOIN (
        SELECT requestorId, COUNT(*) as count
        FROM muzzle
        WHERE messagesSuppressed > 0
        GROUP BY requestorId
        ) AS b
        ON a.muzzledId = b.requestorId
        GROUP BY b.requestorId, a.count, b.count, kdr
        ORDER BY kdr DESC;
        `
        : `
        SELECT b.requestorId, IF(a.count > 0, a.count, 0) AS deaths, b.count as kills, b.count/IF(a.count > 0, a.count, 1) as kdr
        FROM (SELECT muzzledId, COUNT(*) as count FROM muzzle WHERE messagesSuppressed > 0 AND createdAt >= '${
          range.start
        }' AND createdAt <= '${range.end}' GROUP BY muzzledId) as a
        RIGHT JOIN (
        SELECT requestorId, COUNT(*) as count
        FROM muzzle
        WHERE messagesSuppressed > 0 AND createdAt >= '${range.start}' AND createdAt <= '${range.end}'
        GROUP BY requestorId
        ) AS b
        ON a.muzzledId = b.requestorId
        GROUP BY b.requestorId, a.count, b.count, kdr
        ORDER BY kdr DESC;
        `;

    return getRepository(Muzzle).query(query);
  }
  private getBackfireData(range: ReportRange): Promise<any[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `
    SELECT a.muzzledId as muzzledId, a.backfireCount as backfires, b.muzzleCount as muzzles, (a.backfireCount / b.muzzleCount) * 100 as backfirePct
    FROM (SELECT muzzledId, count(*) as backfireCount FROM backfire GROUP BY muzzledId) a,
    (SELECT requestorId, count(*) as muzzleCount FROM muzzle GROUP BY requestorId) b
    WHERE a.muzzledId = b.requestorId ORDER BY backfirePct DESC;`
        : `
    SELECT a.muzzledId as muzzledId, a.backfireCount as backfires, b.muzzleCount as muzzles, (a.backfireCount / b.muzzleCount) * 100 as backfirePct
    FROM (SELECT muzzledId, count(*) as backfireCount FROM backfire WHERE createdAt >= '${
      range.start
    }' AND createdAt < '${range.end}' GROUP BY muzzledId) a,
    (SELECT requestorId, count(*) as muzzleCount FROM muzzle WHERE createdAt >= '${range.start}' AND createdAt < '${
            range.end
          }' GROUP BY requestorId) b
    WHERE a.muzzledId = b.requestorId ORDER BY backfirePct DESC;`;
    return getManager().query(query);
  }

  private getNemesisByRaw(range: ReportRange): Promise<any[]> {
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

  private getNemesisBySuccessful(range: ReportRange): Promise<any[]> {
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
        WHERE createdAt >= '${range.start}' AND createdAt < '${range.end}' AND messagesSuppressed > 0
        GROUP BY requestorId, muzzledId
      ) AS a 
      INNER JOIN(
        SELECT muzzledId, MAX(count) AS count
        FROM (
          SELECT requestorId, muzzledId, COUNT(*) AS count 
          FROM muzzle
          WHERE createdAt >= '${range.start}' AND createdAt < '${range.end}' AND messagesSuppressed > 0
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
