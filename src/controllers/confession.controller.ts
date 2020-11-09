import express, { Router } from 'express';
import { WebService } from '../services/web/web.service';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';

export const confessionController: Router = express.Router();

const webService = WebService.getInstance();
const suppressorService = new SuppressorService();

confessionController.post('/confess', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send('Sorry, you must send a message to confess.');
  } else {
    const confession = `Someone has confessed: 
    \`${request.text}\``;
    webService.sendMessage(request.channel_id, confession);
    res.status(200).send();
  }
});
