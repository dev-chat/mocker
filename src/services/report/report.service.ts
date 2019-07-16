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
      # Muzzle Report
      ## Top Muzzled by Times Muzzled
      \`\`\`
      ${Table.print(formattedReport.muzzled.byInstances)}
      \`\`\`

      ## Top Muzzlers
      \`\`\`
      ${Table.print(formattedReport.muzzlers.byInstances)}
      \`\`\`
      
      ## Top KDR
      \`\`\`
      ${Table.print(formattedReport.KDR)}
      \`\`\`

      ## Top Nemesis
      \`\`\`
      ${Table.print(formattedReport.nemesis)}
      \`\`\`
      `;
  }

  private formatReport(report: any) {
    const reportFormatted = {
      muzzled: {
        byInstances: report.muzzled.byInstances.map((instance: any) => {
          return {
            user: this.slackService.getUserById(instance.muzzledId)!.name,
            timeMuzzled: instance.count
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
      KDR: report.kdr.map((instance: any) => {
        return {
          muzzler: this.slackService.getUserById(instance.muzzle_requestorId)!
            .name,
          kdr: instance.kdr,
          successfulMuzzles: instance.kills,
          totalMuzzles: instance.deaths
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
