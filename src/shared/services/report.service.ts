import moment from 'moment';
import { SlackService } from '../../services/slack/slack.service';
import { ReportType, ReportRange } from '../models/report/report.model';

export class ReportService {
  public slackService: SlackService;

  constructor(slackService: SlackService) {
    this.slackService = slackService;
  }

  public isValidReportType(type: string): boolean {
    const lowerCaseType = type.toLowerCase();
    return (
      lowerCaseType === ReportType.Trailing7 ||
      lowerCaseType === ReportType.Trailing30 ||
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
    } else if (reportType === ReportType.Year) {
      range.start = moment().startOf('year').format('YYYY-MM-DD HH:mm:ss');
      range.end = moment().endOf('year').format('YYYY-MM-DD HH:mm:ss');
    }

    return range;
  }
}
