import Table from "easy-table";
import moment from "moment";
import { ReportType } from "../../shared/models/muzzle/muzzle-models";
import { MuzzlePersistenceService } from "../muzzle/muzzle.persistence.service";
import { SlackService } from "../slack/slack.service";

export class ReportService {
  private slackService = SlackService.getInstance();
  private muzzlePersistenceService = MuzzlePersistenceService.getInstance();

  public async getReport(reportType: ReportType) {
    const muzzleReport = await this.muzzlePersistenceService.retrieveMuzzleReport(
      reportType
    );
    return this.generateFormattedReport(muzzleReport, reportType);
  }

  // There has got to be a better way to do this. This is sooo ugly and requires added maintenance
  public isValidReportType(type: string) {
    return (
      type === ReportType.Day ||
      type === ReportType.Week ||
      type === ReportType.Month ||
      type === ReportType.Year ||
      type === ReportType.AllTime
    );
  }

  public getReportType(type: string): ReportType {
    const lowerCaseType: string = type.toLowerCase();
    if (
      lowerCaseType === ReportType.Day ||
      lowerCaseType === ReportType.Week ||
      lowerCaseType === ReportType.Month ||
      lowerCaseType === ReportType.Year ||
      lowerCaseType === ReportType.AllTime
    ) {
      return lowerCaseType as ReportType;
    }
    return ReportType.AllTime;
  }

  public getReportTitle(type: ReportType) {
    const range = this.muzzlePersistenceService.getRange(type);
    const titles = {
      [ReportType.Day]: `Daily Muzzle Report for ${moment(range.start).format(
        "MM-DD-YYYY"
      )}`,
      [ReportType.Week]: `Weekly Muzzle Report for ${moment(range.start).format(
        "MM-DD-YYYY"
      )} - ${moment(range.end).format("MM-DD-YYYY")}`,
      [ReportType.Month]: `Monthly Muzzle Report for ${moment(
        range.start
      ).format("MM-DD-YYYY")} - ${moment(range.end).format("MM-DD-YYYY")}`,
      [ReportType.Year]: `Annual Muzzle Report for ${moment(range.start).format(
        "MM-DD-YYYY"
      )} - ${moment(range.end).format("MM-DD-YYYY")}`,
      [ReportType.AllTime]: "All Time Muzzle Report"
    };

    return titles[type];
  }

  private generateFormattedReport(report: any, reportType: ReportType): string {
    const formattedReport = this.formatReport(report);
    return `
${this.getReportTitle(reportType)}

Top Muzzled by Times Muzzled
${Table.print(formattedReport.muzzled.byInstances)}

Top Muzzlers
${Table.print(formattedReport.muzzlers.byInstances)}
      
Top Accuracy
${Table.print(formattedReport.accuracy)}

Top KDR
${Table.print(formattedReport.KDR)}

Top Nemesis (Raw)
${Table.print(formattedReport.rawNemesis)}

Top Nemesis (Only Successful)
${Table.print(formattedReport.successNemesis)}
`;
  }

  private formatReport(report: any) {
    const reportFormatted = {
      muzzled: {
        byInstances: report.muzzled.byInstances.map((instance: any) => {
          return {
            User: this.slackService.getUserById(instance.muzzledId)!.name,
            ["Times Muzzled"]: instance.count
          };
        })
      },
      muzzlers: {
        byInstances: report.muzzlers.byInstances.map((instance: any) => {
          return {
            User: this.slackService.getUserById(instance.requestorId)!.name,
            ["Muzzles Issued"]: instance.instanceCount
          };
        })
      },
      accuracy: report.accuracy.map((instance: any) => {
        return {
          User: this.slackService.getUserById(instance.requestorId)!.name,
          Accuracy: instance.accuracy,
          Kills: instance.kills,
          Deaths: instance.deaths
        };
      }),
      KDR: report.kdr.map((instance: any) => {
        return {
          User: this.slackService.getUserById(instance.requestorId)!.name,
          KDR: instance.kdr,
          Kills: instance.kills,
          Deaths: instance.deaths
        };
      }),
      rawNemesis: report.rawNemesis.map((instance: any) => {
        return {
          Killer: this.slackService.getUserById(instance.requestorId)!.name,
          Victim: this.slackService.getUserById(instance.muzzledId)!.name,
          ["Muzzle Attempts"]: instance.killCount
        };
      }),
      successNemesis: report.successNemesis.map((instance: any) => {
        return {
          Killer: this.slackService.getUserById(instance.requestorId)!.name,
          Victim: this.slackService.getUserById(instance.muzzledId)!.name,
          ["Successful Muzzles"]: instance.killCount
        };
      })
    };

    return reportFormatted;
  }
}
