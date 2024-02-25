import express, { Router } from 'express';
import { ConfessionService } from '../services/confession/confession.service';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';
import { WebService } from '../services/web/web.service';
import { SlackPersistenceService } from '../services/slack/slack.persistence.service';
import { SlackService } from '../services/slack/slack.service';

export const confessionController: Router = express.Router();

const webService = new WebService();
const slackPersistenceService = new SlackPersistenceService();
const slackService = new SlackService(webService, slackPersistenceService);

const confessionService = new ConfessionService(webService, slackService);
const suppressorService = new SuppressorService();

confessionController.post('/confess', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send('Sorry, you must send a message to confess.');
  } else {
    confessionService.confess(request.user_id, request.channel_id, request.text);
    res.status(200).send();
  }
});
