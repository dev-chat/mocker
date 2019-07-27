import Table from "easy-table";
import { MuzzlePersistenceService } from "../muzzle/muzzle.persistence.service";
import { SlackService } from "../slack/slack.service";

export class ReportService {
  private slackService = SlackService.getInstance();
  private muzzlePersistenceService = MuzzlePersistenceService.getInstance();

  public async getReport() {
    const muzzleReport = await this.muzzlePersistenceService.retrieveMuzzleReport();
    return this.generateFormattedReport(muzzleReport);
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

Top Nemesis
${Table.print(formattedReport.nemesis)}
`;
  }

  private formatReport(report: any) {
    const reportFormatted = {
      muzzled: {
        byInstances: report.muzzled.byInstances.map((instance: any) => {
          return {
            user: this.slackService.getUserById(instance.muzzledId)!.name,
            timesMuzzled: instance.count
          };
        })
      },
      muzzlers: {
        byInstances: report.muzzlers.byInstances.map((instance: any) => {
          return {
            muzzler: this.slackService.getUserById(instance.muzzle_requestorId)!
              .name,
            muzzlesIssued: instance.instanceCount
          };
        })
      },
      accuracy: report.accuracy.map((instance: any) => {
        return {
          muzzler: this.slackService.getUserById(instance.muzzle_requestorId)!
            .name,
          accuracy: instance.accuracy,
          successfulMuzzles: instance.kills,
          totalMuzzles: instance.deaths
        };
      }),
      KDR: report.kdr.map((instance: any) => {
        return {
          muzzler: this.slackService.getUserById(instance.requestorId)!.name,
          kdr: instance.kdr,
          successfulMuzzles: instance.kills,
          timesMuzzled: instance.deaths
        };
      }),
      nemesis: report.nemesis.map((instance: any) => {
        return {
          muzzler: this.slackService.getUserById(instance.requestorId)!.name,
          muzzled: this.slackService.getUserById(instance.muzzledId)!.name,
          timesMuzzled: instance.killCount
        };
      })
    };

    return reportFormatted;
  }
}
