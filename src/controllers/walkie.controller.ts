import express, { Router } from 'express';
import { ChannelResponse, SlashCommandRequest } from '../shared/models/slack/slack-models';
import { getService } from '../shared/services/service.injector';

export const walkieController: Router = express.Router();

walkieController.post('/walkie', async (req, res) => {
  const suppressorService = getService('SuppressorService');
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send('Sorry, you must send a message to walkie talk.');
  } else {
    const walkieService = getService('WalkieService');
    const slackService = getService('SlackService');
    const walkied: string = walkieService.walkieTalkie(request.text);
    const response: ChannelResponse = {
      attachments: [
        {
          text: walkied,
        },
      ],
      response_type: 'in_channel',
      text: `<@${request.user_id}>`,
    };
    slackService.sendResponse(request.response_url, response);
    res.status(200).send();
  }
});
