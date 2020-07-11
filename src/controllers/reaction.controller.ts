import express, { Router } from 'express';
import { ReactionService } from '../services/reaction/reaction.service';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';

export const reactionController: Router = express.Router();

const suppressorService = new SuppressorService();
const reactionService = new ReactionService();

reactionController.post('/rep/get', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else {
    const repValue = await reactionService.getRep(request.user_id);
    res.send(repValue);
  }
});
