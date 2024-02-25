import express, { Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { getService } from '../shared/services/service.injector';

export const reactionController: Router = express.Router();

reactionController.post('/rep/get', async (req, res) => {
  const suppressorService = getService('SuppressorService');
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else {
    const reactionReportService = getService('ReactionReportService');
    const repValue = await reactionReportService.getRep(request.user_id, request.team_id);
    res.send(repValue);
  }
});
