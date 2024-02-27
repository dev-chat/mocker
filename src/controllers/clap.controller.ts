import express, { Router } from 'express';
import { ChannelResponse, SlashCommandRequest } from '../shared/models/slack/slack-models';
import { getService } from '../shared/services/service.injector';

export const clapController: Router = express.Router();

clapController.post('/clap', async (req, res) => {
  const suppressorService = getService('SuppressorService');
  const clapService = getService('ClapService');
  const slackService = getService('SlackService');

  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send('Sorry, you must send a message to clap.');
  } else {
    const clapped: string = clapService.clap(request.text);
    const response: ChannelResponse = {
      attachments: [
        {
          text: clapped,
        },
      ],
      response_type: 'in_channel',
      text: `<@${request.user_id}>`,
    };
    slackService.sendResponse(request.response_url, response);
    res.status(200).send();
  }
});
