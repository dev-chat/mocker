import type { Router } from 'express';
import express from 'express';
import { AIService } from './ai.service';
import { WebService } from '../shared/services/web/web.service';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';
import { aiMiddleware } from './middleware/aiMiddleware';
import type { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { logger } from '../shared/logger/logger';

export const aiController: Router = express.Router();
aiController.use(suppressedMiddleware);
aiController.use(textMiddleware);
aiController.use(aiMiddleware);

const webService = new WebService();
const aiService = new AIService();
const aiLogger = logger.child({ module: 'AIController' });

aiController.post('/text', (req, res) => {
  const { user_id, team_id, channel_id, text } = req.body;
  res.status(200).send('Processing your request. Please be patient...');
  void aiService.generateText(user_id, team_id, channel_id, text).catch((e) => {
    aiLogger.error(e);
    const errorMessage = `\`Sorry! Your request for ${text} failed. Please try again.\``;
    void webService.sendEphemeral(channel_id, errorMessage, user_id);
    return undefined;
  });
});

aiController.post('/image', (req, res) => {
  const { user_id, team_id, channel_id, text } = req.body;
  res.status(200).send('Processing your request. Please be patient...');
  void aiService.generateImage(user_id, team_id, channel_id, text).catch((e) => {
    aiLogger.error(e);
    const errorMessage = `\`Sorry! Your request for ${text} failed. Please try again.\``;
    void webService.sendEphemeral(channel_id, errorMessage, user_id);
    return undefined;
  });
});

aiController.post('/prompt-with-history', (req, res) => {
  const request: SlashCommandRequest = req.body;
  res.status(200).send('Processing your request. Please be patient...');
  void aiService.promptWithHistory(request).catch((e) => {
    aiLogger.error(e);
    const errorMessage = `\`Sorry! Your request for ${request.text} failed. Please try again.\``;
    void webService.sendEphemeral(request.channel_id, errorMessage, request.user_id);
    return undefined;
  });
});
