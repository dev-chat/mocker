import express, { Router } from 'express';
import { ChannelResponse, SlashCommandRequest } from '../shared/models/slack/slack-models';
import { getService } from '../shared/services/service.injector';

export const mockController: Router = express.Router();

mockController.post('/mock', async (req, res) => {
  const suppressorService = getService('SuppressorService');
  const mockService = getService('MockService');
  const slackService = getService('SlackService');

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
      response_type: 'in_channel',
      text: `<@${request.user_id}>`,
    };
    slackService.sendResponse(request.response_url, response);
    res.status(200).send();
  }
});
