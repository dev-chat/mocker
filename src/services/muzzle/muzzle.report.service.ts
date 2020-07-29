import Table from 'easy-table';
import moment from 'moment';
import { getRepository, getManager } from 'typeorm';
import { Muzzle } from '../../shared/db/models/Muzzle';
import { ReportType, MuzzleReport, ReportCount, ReportRange, Accuracy } from '../../shared/models/report/report.model';
import { ReportService } from '../../shared/services/report.service';

export class MuzzleReportService extends ReportService {
  public async getMuzzleReport(reportType: ReportType): Promise<string> {
    const range = this.getRange(reportType);
    const muzzleReport = await this.retrieveMuzzleReport(range);
    return await this.generateFormattedReport(muzzleReport, reportType);
  }

  public getReportTitle(type: ReportType): string {
    const range = this.getRange(type);
    const titles = {
      [ReportType.Trailing7]: `Trailing 7 Days Report for ${moment(range.start).format('MM-DD-YYYY')} to ${moment(
        range.end,
      ).format('MM-DD-YYYY')}`,
      [ReportType.Week]: `Weekly Muzzle Report for ${moment(range.start).format('MM-DD-YYYY')} to ${moment(
        range.end,
      ).format('MM-DD-YYYY')}`,
      [ReportType.Month]: `Monthly Muzzle Report for ${moment(range.start).format('MM-DD-YYYY')} to ${moment(
        range.end,
      ).format('MM-DD-YYYY')}`,
      [ReportType.Trailing30]: `Trailing 30 Days Report for ${moment(range.start).format('MM-DD-YYYY')} to ${moment(
        range.end,
      ).format('MM-DD-YYYY')}`,
      [ReportType.Year]: `Annual Muzzle Report for ${moment(range.start).format('MM-DD-YYYY')} to ${moment(
        range.end,
      ).format('MM-DD-YYYY')}`,
      [ReportType.AllTime]: 'All Time Muzzle Report',
    };

    return titles[type];
  }

  private async generateFormattedReport(report: MuzzleReport, reportType: ReportType): Promise<string> {
    const formattedReport: any = await this.formatReport(report);
    return `
${this.getReportTitle(reportType)}

  Top Muzzled
  ${Table.print(formattedReport.muzzled.byInstances)}

  Top Muzzlers
  ${Table.print(formattedReport.muzzlers.byInstances)}
      
  Top Accuracy
  ${Table.print(formattedReport.accuracy)}

  Top KDR
  ${Table.print(formattedReport.KDR)}

  Top Nemesis by Attempts
  ${Table.print(formattedReport.rawNemesis)}

  Top Nemesis by Kills
  ${Table.print(formattedReport.successNemesis)}

  Top Backfires by \%
  ${Table.print(formattedReport.backfires)}
`;
  }

  private async formatReport(report: MuzzleReport): Promise<any> {
    const reportFormatted = {
      muzzled: {
        byInstances: await Promise.all(
          report.muzzled.byInstances.map(async (instance: ReportCount) => {
            return {
              User: await this.slackService.getUserNameById(instance.slackId),
              Muzzles: instance.count,
            };
          }),
        ),
      },
      muzzlers: {
        byInstances: await Promise.all(
          report.muzzlers.byInstances.map(async (instance: ReportCount) => {
            return {
              User: await this.slackService.getUserNameById(instance.slackId),
              ['Muzzles Issued']: instance.count,
            };
          }),
        ),
      },
      accuracy: await Promise.all(
        report.accuracy.map(async (instance: any) => {
          return {
            User: await this.slackService.getUserNameById(instance.requestorId),
            Accuracy: instance.accuracy,
            Kills: instance.kills,
            Attempts: instance.deaths,
          };
        }),
      ),
      KDR: await Promise.all(
        report.kdr.map(async (instance: any) => {
          return {
            User: await this.slackService.getUserNameById(instance.requestorId),
            KDR: instance.kdr,
            Kills: instance.kills,
            Deaths: instance.deaths,
          };
        }),
      ),
      rawNemesis: await Promise.all(
        report.rawNemesis.map(async (instance: any) => {
          return {
            Killer: await this.slackService.getUserNameById(instance.requestorId),
            Victim: await this.slackService.getUserNameById(instance.muzzledId),
            Attempts: instance.killCount,
          };
        }),
      ),
      successNemesis: await Promise.all(
        report.successNemesis.map(async (instance: any) => {
          return {
            Killer: await this.slackService.getUserNameById(instance.requestorId),
            Victim: await this.slackService.getUserNameById(instance.muzzledId),
            Kills: instance.killCount,
          };
        }),
      ),
      backfires: await Promise.all(
        report.backfires.map(async (instance: any) => {
          return {
            User: await this.slackService.getUserNameById(instance.muzzledId),
            Backfires: instance.backfires,
            Muzzles: instance.muzzles,
            Percentage: instance.backfirePct,
          };
        }),
      ),
    };
    return reportFormatted;
  }
  /** Wrapper to generate a generic muzzle report in */
  public async retrieveMuzzleReport(range: ReportRange): Promise<MuzzleReport> {
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

  // TODO: Add Team ID to the query.
  private getMostMuzzledByInstances(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT muzzledId as slackId, COUNT(*) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT muzzledId as slackId, COUNT(*) as count FROM muzzle WHERE createdAt >= '${range.start}' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  // TODO: Add Team ID to the query.
  private getMuzzlerByInstances(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT requestorId as slackId, COUNT(*) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT requestorId as slackId, COUNT(*) as count FROM muzzle WHERE createdAt >= '${range.start}' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  // TODO: Add Team ID to the query.
  private getMuzzlerByMessages(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT requestorId as slackId, SUM(messagesSuppressed) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT requestorId as slackId, SUM(messagesSuppressed) as count FROM muzzle WHERE createdAt >= '${range.start}' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  // TODO: Add Team ID to the query.
  private getMostMuzzledByMessages(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT muzzledId as slackId, SUM(messagesSuppressed) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT muzzledId as slackId, SUM(messagesSuppressed) as count FROM muzzle WHERE createdAt >= '${range.start}' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  // TODO: Add Team ID to the query.
  private getMostMuzzledByWords(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT muzzledId as slackId, SUM(wordsSuppressed) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT muzzledId as slackId, SUM(wordsSuppressed) as count FROM muzzle WHERE createdAt >= '${range.start}' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  // TODO: Add Team ID to the query.
  private getMuzzlerByWords(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT requestorId as slackId, SUM(wordsSuppressed) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT requestorId as slackId, SUM(wordsSuppressed) as count FROM muzzle WHERE createdAt >= '${range.start}' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  // TODO: Add Team ID to the query.
  private getMostMuzzledByChars(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT muzzledId as slackId, SUM(charactersSuppressed) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT muzzledId as slackId, SUM(charactersSuppressed) as count FROM muzzle WHERE createdAt >= '${range.start}' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  // TODO: Add Team ID to the query.
  private getMuzzlerByChars(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT requestorId as slackId, SUM(charactersSuppressed) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT requestorId as slackId, SUM(charactersSuppressed) as count FROM muzzle WHERE createdAt >= '${range.start}' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  // TODO: Add Team ID to the query.
  private getMostMuzzledByTime(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT muzzledId as slackId, SUM(milliseconds) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT muzzledId as slackId, SUM(milliseconds) as count FROM muzzle WHERE createdAt >= '${range.start}' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  // TODO: Add Team ID to the query.
  private getMuzzlerByTime(range: ReportRange): Promise<ReportCount[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT requestorId as slackId, SUM(milliseconds) as count FROM muzzle GROUP BY slackId ORDER BY count DESC;`
        : `SELECT requestorId as slackId, SUM(milliseconds) as count FROM muzzle WHERE createdAt >= '${range.start}' AND createdAt < '${range.end}' GROUP BY slackId ORDER BY count DESC;`;

    return getRepository(Muzzle).query(query);
  }

  // TODO: Add Team ID to the query.
  private getAccuracy(range: ReportRange): Promise<Accuracy[]> {
    const query =
      range.reportType === ReportType.AllTime
        ? `SELECT requestorId, SUM(IF(messagesSuppressed > 0, 1, 0))/COUNT(*) as accuracy, SUM(IF(muzzle.messagesSuppressed > 0, 1, 0)) as kills, COUNT(*) as deaths
               FROM muzzle GROUP BY requestorId ORDER BY accuracy DESC;`
        : `SELECT requestorId, SUM(IF(messagesSuppressed > 0, 1, 0))/COUNT(*) as accuracy, SUM(IF(muzzle.messagesSuppressed > 0, 1, 0)) as kills, COUNT(*) as deaths FROM muzzle WHERE createdAt >= '${range.start}' AND createdAt < '${range.end}' GROUP BY requestorId ORDER BY accuracy DESC;`;

    return getRepository(Muzzle).query(query);
  }

  // TODO: Add Team ID to the query.
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
            FROM (SELECT muzzledId, COUNT(*) as count FROM muzzle WHERE messagesSuppressed > 0 AND createdAt >= '${range.start}' AND createdAt <= '${range.end}' GROUP BY muzzledId) as a
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

  // TODO: Add Team ID to the query.
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
        FROM (SELECT muzzledId, count(*) as backfireCount FROM backfire WHERE createdAt >= '${range.start}' AND createdAt < '${range.end}' GROUP BY muzzledId) a,
        (SELECT requestorId, count(*) as muzzleCount FROM muzzle WHERE createdAt >= '${range.start}' AND createdAt < '${range.end}' GROUP BY requestorId) b
        WHERE a.muzzledId = b.requestorId ORDER BY backfirePct DESC;`;
    return getManager().query(query);
  }

  // TODO: Add Team ID to the query.
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

  // TODO: Add Team ID to the query.
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
