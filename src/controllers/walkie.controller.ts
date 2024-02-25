import express, { Router } from 'express';
import { SlackService } from '../services/slack/slack.service';
import { WalkieService } from '../services/walkie/walkie.service';
import { ChannelResponse, SlashCommandRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';
import { SlackPersistenceService } from '../services/slack/slack.persistence.service';
import { WebService } from '../services/web/web.service';

export const walkieController: Router = express.Router();

const suppressorService = new SuppressorService();
const webService = new WebService();
const slackPersistenceService = new SlackPersistenceService();
const slackService = new SlackService(webService, slackPersistenceService);
const walkieService = new WalkieService();

walkieController.post('/walkie', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send('Sorry, you must send a message to walkie talk.');
  } else {
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
