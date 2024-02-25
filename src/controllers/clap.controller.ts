import express, { Router } from 'express';
import { ChannelResponse, SlashCommandRequest } from '../shared/models/slack/slack-models';
import { ClapService } from '../services/clap/clap.service';
import { SlackService } from '../services/slack/slack.service';
import { SuppressorService } from '../shared/services/suppressor.service';
import { WebService } from '../services/web/web.service';
import { SlackPersistenceService } from '../services/slack/slack.persistence.service';

export const clapController: Router = express.Router();
const webService = new WebService();
const slackPersistenceService = new SlackPersistenceService();
const slackService = new SlackService(webService, slackPersistenceService);
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
