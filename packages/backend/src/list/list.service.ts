import Table from 'easy-table';
import { ReportService } from '../shared/services/report.service';
import { getManager } from 'typeorm';
import type { ListUser } from './ListUser.model';
import { WebService } from '../shared/services/web/web.service';
import type { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { ListPersistenceService } from './list.persistence.service';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';

export class ListService extends ReportService {
  listPersistenceService = new ListPersistenceService();
  webService = new WebService();
  logger = logger.child({ module: 'ListService' });

  public async getListReport(request: SlashCommandRequest): Promise<void> {
    const query = `SELECT u.name, l.text FROM list AS l INNER JOIN slack_user AS u ON u.slackId=l.requestorId WHERE l.channelId='${request.channel_id}';`;
    const listReport = await getManager().query(query);
    const formattedReport = this.formatListReport(listReport, request.channel_name);
    this.webService.uploadFile(request.channel_id, formattedReport, `#${request.channel_name}'s List`, request.user_id);
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

  async list(request: SlashCommandRequest): Promise<void> {
    await this.listPersistenceService.store(request.user_id, request.text, request.team_id, request.channel_id);
    const response = {
      response_type: 'in_channel',
      text: `\`${request.text}\` has been \`listed\``,
    };
    this.slackService.sendResponse(request.response_url, response);
  }

  async remove(request: SlashCommandRequest): Promise<void> {
    try {
      await this.listPersistenceService.remove(request.text);
      const response = {
        response_type: 'in_channel',
        text: `\`${request.text}\` has been removed from \`The List\``,
      };
      this.slackService.sendResponse(request.response_url, response);
    } catch (e) {
      logError(this.logger, 'Failed to remove list item', e, {
        userId: request.user_id,
        teamId: request.team_id,
        channelId: request.channel_id,
        text: request.text,
      });
      const errorResponse = {
        response_type: 'ephemeral',
        text: 'An error occurred while trying to remove the item from the list.',
      };
      this.slackService.sendResponse(request.response_url, errorResponse);
    }
  }
}
