import express, { Router } from 'express';
import { MockService } from '../services/mock/mock.service';
import { SlackService } from '../services/slack/slack.service';
import { ChannelResponse, SlashCommandRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';

export const mockController: Router = express.Router();

const suppressorService = new SuppressorService();
const slackService = SlackService.getInstance();
const mockService = MockService.getInstance();

mockController.post('/mock', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send('Sorry, you must send a message to mock.');
  } else {
    const mocked: string = mockService.mock(request.text);
    const response: ChannelResponse = {
      attachments: [
        {
          text: mocked,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/camelcase
      response_type: 'in_channel',
      text: `<@${request.user_id}>`,
    };
    slackService.sendResponse(request.response_url, response);
    res.status(200).send();
  }
});
