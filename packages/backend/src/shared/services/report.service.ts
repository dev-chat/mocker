import moment from 'moment';
import type { ReportRange } from '../models/report/report.model';
import { ReportType } from '../models/report/report.model';
import { SlackService } from './slack/slack.service';

const REPORT_TYPE_LOOKUP: Record<string, ReportType> = {
  [ReportType.Trailing7]: ReportType.Trailing7,
  [ReportType.Trailing30]: ReportType.Trailing30,
  [ReportType.Week]: ReportType.Week,
  [ReportType.Month]: ReportType.Month,
  [ReportType.Year]: ReportType.Year,
  [ReportType.AllTime]: ReportType.AllTime,
};

export class ReportService {
  public slackService = new SlackService();

  public isValidReportType(type: string): boolean {
    const lowerCaseType = type.toLowerCase();
    return Object.hasOwn(REPORT_TYPE_LOOKUP, lowerCaseType);
  }

  public getReportType(type: string): ReportType {
    const lowerCaseType: string = type.toLowerCase();
    return REPORT_TYPE_LOOKUP[lowerCaseType] ?? ReportType.AllTime;
  }

  public getRange(reportType: ReportType): ReportRange {
    const range: ReportRange = {
      reportType,
    };

    if (reportType === ReportType.AllTime) {
      range.reportType = ReportType.AllTime;
    } else if (reportType === ReportType.Week) {
      range.start = moment().startOf('week').subtract(1, 'week').format('YYYY-MM-DD HH:mm:ss');
      range.end = moment().endOf('week').subtract(1, 'week').format('YYYY-MM-DD HH:mm:ss');
    } else if (reportType === ReportType.Month) {
      range.start = moment().startOf('month').subtract(1, 'month').format('YYYY-MM-DD HH:mm:ss');
      range.end = moment().endOf('month').subtract(1, 'month').format('YYYY-MM-DD HH:mm:ss');
    } else if (reportType === ReportType.Trailing30) {
      range.start = moment().startOf('day').subtract(30, 'days').format('YYYY-MM-DD HH:mm:ss');
      range.end = moment().format('YYYY-MM-DD HH:mm:ss');
    } else if (reportType === ReportType.Trailing7) {
      range.start = moment().startOf('day').subtract(7, 'days').format('YYYY-MM-DD HH:mm:ss');
      range.end = moment().format('YYYY-MM-DD HH:mm:ss');
    } else {
      range.start = moment().startOf('year').format('YYYY-MM-DD HH:mm:ss');
      range.end = moment().endOf('year').format('YYYY-MM-DD HH:mm:ss');
    }

    return range;
  }
}
