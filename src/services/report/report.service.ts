import Table from "easy-table";
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
    return this.generateFormattedReport(muzzleReport);
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

  private generateFormattedReport(report: any): string {
    const formattedReport = this.formatReport(report);
    return `
Muzzle Report

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
            User: this.slackService.getUserById(instance.muzzle_requestorId)!
              .name,
            ["Muzzles Issued"]: instance.instanceCount
          };
        })
      },
      accuracy: report.accuracy.map((instance: any) => {
        return {
          User: this.slackService.getUserById(instance.muzzle_requestorId)!
            .name,
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
