import type { Router } from 'express';
import express from 'express';
import type { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { WalkieService } from './walkie.service';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';

export const walkieController: Router = express.Router();

const walkieService = new WalkieService();
const walkieLogger = logger.child({ module: 'WalkieController' });

walkieController.use(suppressedMiddleware);

walkieController.post('/', (req, res) => {
  const request: SlashCommandRequest = req.body;
  void Promise.resolve(walkieService.walkieTalkie(request)).catch((e) => {
    logError(walkieLogger, 'Failed to handle /walkie request', e, {
      userId: request.user_id,
      channelId: request.channel_id,
      responseUrl: request.response_url,
      text: request.text,
    });
  });
  res.status(200).send();
});
