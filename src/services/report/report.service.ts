import Table from "easy-table";
import moment from "moment";
import { List } from "../../shared/db/models/List";
import { ReportType } from "../../shared/models/muzzle/muzzle-models";
import { ListPersistenceService } from "../list/list.persistence.service";
import { MuzzlePersistenceService } from "../muzzle/muzzle.persistence.service";
import { SlackService } from "../slack/slack.service";

export class ReportService {
  private slackService = SlackService.getInstance();
  private muzzlePersistenceService = MuzzlePersistenceService.getInstance();
  private listPersistenceService = ListPersistenceService.getInstance();

  public async getListReport() {
    const listReport = await this.listPersistenceService.retrieve();
    return this.formatListReport(listReport);
  }

  public async getMuzzleReport(reportType: ReportType) {
    const muzzleReport = await this.muzzlePersistenceService.retrieveMuzzleReport(
      reportType
    );
    return this.generateFormattedReport(muzzleReport, reportType);
  }

  public isValidReportType(type: string) {
    const lowerCaseType = type.toLowerCase();
    return (
      lowerCaseType === ReportType.Week ||
      lowerCaseType === ReportType.Month ||
      lowerCaseType === ReportType.Year ||
      lowerCaseType === ReportType.AllTime
    );
  }

  public getReportType(type: string): ReportType {
    const lowerCaseType: string = type.toLowerCase();
    if (this.isValidReportType(type)) {
      return lowerCaseType as ReportType;
    }
    return ReportType.AllTime;
  }

  public getReportTitle(type: ReportType) {
    const range = this.muzzlePersistenceService.getRange(type);
    const titles = {
      [ReportType.Week]: `Weekly Muzzle Report for ${moment(range.start).format(
        "MM-DD-YYYY"
      )} to ${moment(range.end).format("MM-DD-YYYY")}`,
      [ReportType.Month]: `Monthly Muzzle Report for ${moment(
        range.start
      ).format("MM-DD-YYYY")} to ${moment(range.end).format("MM-DD-YYYY")}`,
      [ReportType.Year]: `Annual Muzzle Report for ${moment(range.start).format(
        "MM-DD-YYYY"
      )} to ${moment(range.end).format("MM-DD-YYYY")}`,
      [ReportType.AllTime]: "All Time Muzzle Report"
    };

    return titles[type];
  }

  private formatListReport(report: any) {
    const reportWithoutDate = report.map((listItem: List) => {
      return {
        Item: listItem.text,
        "Added By": this.slackService.getUserName(listItem.requestorId)
      };
    });

    return `
The List
    
${Table.print(reportWithoutDate)}
`;
  }
  private generateFormattedReport(report: any, reportType: ReportType): string {
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
`;
  }

  private formatReport(report: any) {
    const reportFormatted = {
      muzzled: {
        byInstances: report.muzzled.byInstances.map((instance: any) => {
          return {
            User: this.slackService.getUserById(instance.muzzledId)!.name,
            Muzzles: instance.count
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
          Attempts: instance.deaths
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
          Attempts: instance.killCount
        };
      }),
      successNemesis: report.successNemesis.map((instance: any) => {
        return {
          Killer: this.slackService.getUserById(instance.requestorId)!.name,
          Victim: this.slackService.getUserById(instance.muzzledId)!.name,
          Kills: instance.killCount
        };
      })
    };

    return reportFormatted;
  }
}
