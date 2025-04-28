import { ChannelResponse, SlashCommandRequest } from '../shared/models/slack/slack-models';
import { SlackService } from '../shared/services/slack/slack.service';

export class MockService {
  slackService = SlackService.getInstance();

  public mock(request: SlashCommandRequest): void {
    let mocked = '';
    let shouldChangeCase = true;
    for (const letter of request.text) {
      if (letter === ' ') {
        mocked += letter;
      } else {
        mocked += shouldChangeCase ? letter.toLowerCase() : letter.toUpperCase();
        shouldChangeCase = !shouldChangeCase;
      }
    }

    const response: ChannelResponse = {
      attachments: [
        {
          text: mocked,
        },
      ],
      response_type: 'in_channel',
      text: `<@${request.user_id}>`,
    };

    this.slackService.sendResponse(request.response_url, response);
  }
}
