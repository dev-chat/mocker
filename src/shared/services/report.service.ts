import { ListPersistenceService } from '../../services/list/list.persistence.service';
import { SlackService } from '../../services/slack/slack.service';
import { ReportType } from '../models/report/report.model';
import { MuzzlePersistenceService } from '../../services/muzzle/muzzle.persistence.service';
import { ReactionPersistenceService } from '../../services/reaction/reaction.persistence.service';

export class ReportService {
  public slackService = SlackService.getInstance();
  protected persistenceService:
    | MuzzlePersistenceService
    | ListPersistenceService
    | ReactionPersistenceService
    | undefined;

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
}
