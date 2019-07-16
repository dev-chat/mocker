import Table from "easy-table";
import { IAttachment } from "../../shared/models/slack/slack-models";
import { MuzzlePersistenceService } from "../muzzle/muzzle.persistence.service";
import { SlackService } from "../slack/slack.service";

export class ReportService {
  private slackService = SlackService.getInstance();
  private muzzlePersistenceService = MuzzlePersistenceService.getInstance();

  public async getReport() {
    const muzzleReport = await this.muzzlePersistenceService.retrieveMuzzleReport();
    return this.generateFormattedReport(muzzleReport);
  }

  private generateFormattedReport(report: any): IAttachment[] {
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
