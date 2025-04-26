import express, { Router } from 'express';
import { ChannelResponse, SlashCommandRequest } from '../shared/models/slack/slack-models';
import { ClapService } from './clap.service';
import { SuppressorService } from '../shared/services/suppressor.service';
import { SlackService } from '../shared/services/slack/slack.service';

export const clapController: Router = express.Router();

const slackService = SlackService.getInstance();
const clapService = new ClapService();
const suppressorService = new SuppressorService();

clapController.post('/clap', async (req, res) => {
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
