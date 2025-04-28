import { ChannelResponse, SlashCommandRequest } from '../shared/models/slack/slack-models';
import { SlackService } from '../shared/services/slack/slack.service';
import { NATO_MAPPINGS, USER_ID_REGEX } from './constants';

export class WalkieService {
  slackService = SlackService.getInstance();

  public getUserId(user: string): string {
    if (!user) {
      return '';
    }
    const regArray = user.match(USER_ID_REGEX);
    return regArray ? regArray[0].slice(2) : '';
  }

  public getNatoName(longUserId: string): string {
    const userId = this.getUserId(longUserId);
    return NATO_MAPPINGS[userId] || longUserId;
  }

  public walkieTalkie(request: SlashCommandRequest): void {
    const { text } = request;
    if (!text || text.length === 0) {
      return;
    }

    const userIds = text.match(/[<]@\w+[ ]?\|[ ]?\w+[>]/gm);
    let fullText = text;

    if (userIds && userIds.length) {
      for (const userId of userIds) {
        fullText = fullText.replace(userId, this.getNatoName(userId));
      }
    }

    const response: ChannelResponse = {
      attachments: [
        {
          text: `:walkietalkie: *chk* ${fullText} over. *chk* :walkietalkie:`,
        },
      ],
      response_type: 'in_channel',
      text: `<@${request.user_id}>`,
    };

    this.slackService.sendResponse(request.response_url, response);
  }
}
