import express, { Router } from 'express';
import { AIService } from './ai.service';
import { WebService } from '../shared/services/web/web.service';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';
import { aiMiddleware } from './middleware/aiMiddleware';

export const aiController: Router = express.Router();
aiController.use(suppressedMiddleware);
aiController.use(textMiddleware);
aiController.use(aiMiddleware);

const webService = WebService.getInstance();
const aiService = new AIService();

aiController.post('/ai/text', async (req, res) => {
  const { user_id, team_id, channel_id, text } = req.body;
  res.status(200).send('Processing your request. Please be patient...');
  aiService.generateText(user_id, team_id, channel_id, text).catch((e) => {
    console.error(e);
    const errorMessage = `\`Sorry! Your request for ${text} failed. Please try again.\``;
    webService.sendEphemeral(channel_id, errorMessage, user_id);
    return undefined;
  });
});

aiController.post('/ai/gemini/text', (req, res) => {
  const { user_id, team_id, channel_id, text } = req.body;
  res.status(200).send('Processing your request. Please be patient...');
  aiService.generateGeminiText(user_id, team_id, channel_id, text).catch((e) => {
    console.error(e);
    const errorMessage = `\`Sorry! Your request for ${text} failed. Please try again.\``;
    webService.sendEphemeral(channel_id, errorMessage, user_id);
    return undefined;
  });
});

aiController.post('/ai/image', (req, res) => {
  const { user_id, team_id, channel_id, text } = req.body;
  res.status(200).send('Processing your request. Please be patient...');
  aiService.generateImage(user_id, team_id, text).catch((e) => {
    console.error(e);
    const errorMessage = `\`Sorry! Your request for ${text} failed. Please try again.\``;
    webService.sendEphemeral(channel_id, errorMessage, user_id);
    return undefined;
  });
});
