import type { Router } from 'express';
import express from 'express';
import type { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { ReactionReportService } from './reaction.report.service';
import { suppressedMiddleware } from '../shared/middleware/suppression';

export const reactionController: Router = express.Router();
reactionController.use(suppressedMiddleware);

const reportService = new ReactionReportService();

reactionController.post('/get', (req, res) => {
  const request: SlashCommandRequest = req.body;
  reportService
    .getRep(request.user_id, request.team_id)
    .then((repValue) => res.send(repValue))
    .catch((e) => res.status(500).send(e));
});
