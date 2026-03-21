import type { Router } from 'express';
import express from 'express';
import type { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { ReactionReportService } from './reaction.report.service';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { logger } from '../shared/logger/logger';

export const reactionController: Router = express.Router();
reactionController.use(suppressedMiddleware);

const reportService = new ReactionReportService();
const reactionLogger = logger.child({ module: 'ReactionController' });

reactionController.post('/get', (req, res) => {
  const request: SlashCommandRequest = req.body;
  reportService
    .getRep(request.user_id, request.team_id)
    .then((repValue) => res.send(repValue))
    .catch((e: unknown) => {
      reactionLogger.error(e);
      res.status(500).send(e instanceof Error ? e.message : String(e));
    });
});
