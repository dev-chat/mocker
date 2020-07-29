import express, { Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';
import { ReactionReportService } from '../services/reaction/reaction.report.service';

export const reactionController: Router = express.Router();

const suppressorService = new SuppressorService();
const reportService = new ReactionReportService();

reactionController.post('/rep/get', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else {
    const repValue = await reportService.getRep(request.user_id, request.team_id);
    res.send(repValue);
  }
});
