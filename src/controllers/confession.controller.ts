import express, { Router } from 'express';
import { ConfessionService } from '../services/confession/confession.service';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';

export const confessionController: Router = express.Router();

const confessionService = new ConfessionService();
const suppressorService = new SuppressorService();

confessionController.post('/confess', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send('Sorry, you must send a message to confess.');
  } else {
    confessionService.confess(request.user_id, request.team_id, request.channel_id, request.text);
    res.status(200).send();
  }
});
