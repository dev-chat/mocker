import { ReportService } from '../../shared/services/report.service';
import { ListPersistenceService } from './list.persistence.service';
import { List } from '../../shared/db/models/List';
import Table from 'easy-table';

export class ListReportService extends ReportService {
  persistenceService = ListPersistenceService.getInstance();

  public async getListReport(): Promise<string> {
    const listReport = await this.persistenceService.retrieve();
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
