import express, { Router } from 'express';
import { AIService } from './ai.service';
import { WebService } from '../shared/services/web/web.service';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';
import { aiMiddleware } from './middleware/aiMiddleware';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { logger } from '../shared/logger/logger';

export const aiController: Router = express.Router();
aiController.use(suppressedMiddleware);
aiController.use(textMiddleware);
aiController.use(aiMiddleware);

const webService = new WebService();
const aiService = new AIService();
const aiLogger = logger.child({ module: 'AIController' });

aiController.post('/text', async (req, res) => {
  const { user_id, team_id, channel_id, text } = req.body;
  res.status(200).send('Processing your request. Please be patient...');
  aiService.generateText(user_id, team_id, channel_id, text).catch((e) => {
    aiLogger.error(e);
    const errorMessage = `\`Sorry! Your request for ${text} failed. Please try again.\``;
    webService.sendEphemeral(channel_id, errorMessage, user_id);
    return undefined;
  });
});

aiController.post('/gemini/text', (req, res) => {
  // const { user_id, team_id, channel_id, text } = req.body;
  res.status(200).send('Gemini is deprecated due to lack of use. Please use OpenAI instead.');
  // aiService.generateGeminiText(user_id, team_id, channel_id, text).catch((e) => {
  //   aiLogger.error(e);
  //   const errorMessage = `\`Sorry! Your request for ${text} failed. Please try again.\``;
  //   webService.sendEphemeral(channel_id, errorMessage, user_id);
  //   return undefined;
  // });
});

aiController.post('/image', (req, res) => {
  const { user_id, team_id, channel_id, text } = req.body;
  res.status(200).send('Processing your request. Please be patient...');
  aiService.generateImage(user_id, team_id, channel_id, text).catch((e) => {
    aiLogger.error(e);
    const errorMessage = `\`Sorry! Your request for ${text} failed. Please try again.\``;
    webService.sendEphemeral(channel_id, errorMessage, user_id);
    return undefined;
  });
});

aiController.post('/prompt-with-history', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  res.status(200).send('Processing your request. Please be patient...');
  aiService.promptWithHistory(request);
});
