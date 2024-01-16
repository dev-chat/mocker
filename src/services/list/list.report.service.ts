import Table from 'easy-table';
import { ReportService } from '../../shared/services/report.service';
import { getManager } from 'typeorm';
import { ListUser } from './ListUser.model';

export class ListReportService extends ReportService {
  // TODO: Add Team ID to the query.
  public async getListReport(channelId: string, channelName: string): Promise<string> {
    const query = `SELECT u.name, l.text FROM list AS l INNER JOIN slack_user AS u ON u.slackId=l.requestorId WHERE l.channelId='${channelId}';`;
    const listReport = await getManager().query(query);
    return this.formatListReport(listReport, channelName);
  }

  private formatListReport(report: ListUser[], channelName: string): string {
    const reportWithoutDate = report.map((listItem: ListUser) => {
      return { Item: `${listItem.text} - ${listItem.name}` };
    });

    return `
#${channelName} List
    
${Table.print(reportWithoutDate)}
`;
  }
}
