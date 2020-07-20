import { ReportService } from '../../shared/services/report.service';
import { MuzzlePersistenceService } from './muzzle.persistence.service';
import { ReportType, MuzzleReport, ReportCount } from '../../shared/models/report/report.model';
import Table from 'easy-table';
import moment from 'moment';

export class MuzzleReportService extends ReportService {
  persistenceService = MuzzlePersistenceService.getInstance();

  public async getMuzzleReport(reportType: ReportType): Promise<string> {
    const muzzleReport = await this.persistenceService.retrieveMuzzleReport(reportType);
    return this.generateFormattedReport(muzzleReport, reportType);
  }

  public getReportTitle(type: ReportType): string {
    const range = this.persistenceService.getRange(type);
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

  private generateFormattedReport(report: MuzzleReport, reportType: ReportType): string {
    const formattedReport = this.formatReport(report);
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

  private formatReport(report: MuzzleReport): any {
    const reportFormatted = {
      muzzled: {
        byInstances: report.muzzled.byInstances.map((instance: ReportCount) => {
          return {
            User: this.slackService.getUserById(instance.slackId)!.name,
            Muzzles: instance.count,
          };
        }),
      },
      muzzlers: {
        byInstances: report.muzzlers.byInstances.map((instance: ReportCount) => {
          return {
            User: this.slackService.getUserById(instance.slackId)!.name,
            ['Muzzles Issued']: instance.count,
          };
        }),
      },
      accuracy: report.accuracy.map((instance: any) => {
        return {
          User: this.slackService.getUserById(instance.requestorId)!.name,
          Accuracy: instance.accuracy,
          Kills: instance.kills,
          Attempts: instance.deaths,
        };
      }),
      KDR: report.kdr.map((instance: any) => {
        return {
          User: this.slackService.getUserById(instance.requestorId)!.name,
          KDR: instance.kdr,
          Kills: instance.kills,
          Deaths: instance.deaths,
        };
      }),
      rawNemesis: report.rawNemesis.map((instance: any) => {
        return {
          Killer: this.slackService.getUserById(instance.requestorId)!.name,
          Victim: this.slackService.getUserById(instance.muzzledId)!.name,
          Attempts: instance.killCount,
        };
      }),
      successNemesis: report.successNemesis.map((instance: any) => {
        return {
          Killer: this.slackService.getUserById(instance.requestorId)!.name,
          Victim: this.slackService.getUserById(instance.muzzledId)!.name,
          Kills: instance.killCount,
        };
      }),
      backfires: report.backfires.map((instance: any) => {
        return {
          User: this.slackService.getUserById(instance.muzzledId)!.name,
          Backfires: instance.backfires,
          Muzzles: instance.muzzles,
          Percentage: instance.backfirePct,
        };
      }),
    };

    return reportFormatted;
  }
}
