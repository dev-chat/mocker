import express, { Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { ReactionReportService } from './reaction.report.service';
import { suppressedMiddleware } from '../shared/middleware/suppression';

export const reactionController: Router = express.Router();
reactionController.use(suppressedMiddleware);

const reportService = new ReactionReportService();

reactionController.post('/get', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  const repValue = await reportService.getRep(request.user_id, request.team_id);
  res.send(repValue);
});
