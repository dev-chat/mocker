import express, { Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';
import { ReactionReportService } from '../services/reaction/reaction.report.service';
import { ReactionService } from '../services/reaction/reaction.service';

export const reactionController: Router = express.Router();

const suppressorService = new SuppressorService();
const reportService = new ReactionReportService();
const reactionService = new ReactionService();

reactionController.post('/rep/get', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else {
    const repValue = await reportService.getRep(request.user_id, request.team_id);
    res.send(repValue);
  }
});

reactionController.post('/rep/give', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  const [receivingUser, amount] = req.body.text.split(' ');
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else {
    const giveRep = await reactionService.giveRep(request.user_id, receivingUser, amount, request.team_id);
    res.send(giveRep);
  }
});
