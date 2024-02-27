import express, { Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { getService } from '../shared/services/service.injector';

export const confessionController: Router = express.Router();

confessionController.post('/confess', async (req, res) => {
  const suppressorService = getService('SuppressorService');
  const confessionService = getService('ConfessionService');

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
