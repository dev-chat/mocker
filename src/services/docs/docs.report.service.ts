import Table from 'easy-table';
import { ReportService } from '../../shared/services/report.service';
import { getRepository } from 'typeorm';
import { Docs } from '../../shared/db/models/Docs';

export class DocsReportService extends ReportService {
  // TODO: Add Team ID to the query.
  public async getListReport(): Promise<string> {
    const listReport = await getRepository(Docs).find();
    return this.formatListReport(listReport);
  }

  private formatListReport(report: any): string {
    const reportWithoutDate = report.map((listItem: Docs) => {
      return { Item: listItem.text };
    });

    return `
The Docs
    
${Table.print(reportWithoutDate)}
`;
  }
}
