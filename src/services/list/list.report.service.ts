import Table from 'easy-table';
import { ReportService } from '../../shared/services/report.service';
import { List } from '../../shared/db/models/List';
import { getRepository } from 'typeorm';

export class ListReportService extends ReportService {
  public async getListReport(): Promise<string> {
    const listReport = await getRepository(List).find();
    return this.formatListReport(listReport);
  }

  private formatListReport(report: any): string {
    const reportWithoutDate = report.map((listItem: List) => {
      return { Item: listItem.text };
    });

    return `
The List
    
${Table.print(reportWithoutDate)}
`;
  }
}
