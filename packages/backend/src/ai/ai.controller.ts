import type { Router } from 'express';
import express from 'express';
import { AIService } from './ai.service';
import { WebService } from '../shared/services/web/web.service';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';
import { aiMiddleware } from './middleware/aiMiddleware';
import type { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';
import { UserPromptPersistenceService } from './user-prompt.persistence.service';

export const aiController: Router = express.Router();

const webService = new WebService();
const aiService = new AIService();
const userPromptPersistenceService = new UserPromptPersistenceService();
const aiLogger = logger.child({ module: 'AIController' });

// /set-prompt does not require rate-limiting or text-length validation
aiController.post('/set-prompt', (req, res) => {
  const { user_id, team_id, text } = req.body;

  if (!text) {
    void userPromptPersistenceService.getCustomPrompt(user_id, team_id).then((prompt) => {
      if (prompt) {
        res.send(`Your current custom prompt: "${prompt}"`);
      } else {
        res.send(
          'You have no custom prompt set. Use `/set-prompt [prompt]` to set one, or `/set-prompt clear` to remove it.',
        );
      }
    });
    return;
  }

  if (text.toLowerCase() === 'clear') {
    void userPromptPersistenceService.clearCustomPrompt(user_id, team_id).then((success) => {
      if (success) {
        res.send('Your custom prompt has been cleared. Moonbeam will use the default instructions.');
      } else {
        res.send('Failed to clear your custom prompt. Please try again.');
      }
    });
    return;
  }

  void userPromptPersistenceService.setCustomPrompt(user_id, team_id, text).then((success) => {
    if (success) {
      res.send(`Your custom prompt has been set.`);
    } else {
      res.send('Failed to set your custom prompt. Please try again.');
    }
  });
});

aiController.use(suppressedMiddleware);
aiController.use(textMiddleware);
aiController.use(aiMiddleware);

aiController.post('/text', (req, res) => {
  const { user_id, team_id, channel_id, text } = req.body;
  res.status(200).send('Processing your request. Please be patient...');
  void aiService.generateText(user_id, team_id, channel_id, text).catch((e) => {
    logError(aiLogger, 'Failed to generate AI text response', e, {
      userId: user_id,
      teamId: team_id,
      channelId: channel_id,
      prompt: text,
    });
    const errorMessage = `\`Sorry! Your request for ${text} failed. Please try again.\``;
    void webService.sendEphemeral(channel_id, errorMessage, user_id);
    return undefined;
  });
});

aiController.post('/image', (req, res) => {
  const { user_id, team_id, channel_id, text } = req.body;
  res.status(200).send('Processing your request. Please be patient...');
  void aiService.generateImage(user_id, team_id, channel_id, text).catch((e) => {
    logError(aiLogger, 'Failed to generate AI image response', e, {
      userId: user_id,
      teamId: team_id,
      channelId: channel_id,
      prompt: text,
    });
    const errorMessage = `\`Sorry! Your request for ${text} failed. Please try again.\``;
    void webService.sendEphemeral(channel_id, errorMessage, user_id);
    return undefined;
  });
});

aiController.post('/prompt-with-history', (req, res) => {
  const request: SlashCommandRequest = req.body;
  res.status(200).send('Processing your request. Please be patient...');
  void aiService.promptWithHistory(request).catch((e) => {
    logError(aiLogger, 'Failed to process AI prompt with history', e, {
      userId: request.user_id,
      teamId: request.team_id,
      channelId: request.channel_id,
      prompt: request.text,
    });
    const errorMessage = `\`Sorry! Your request for ${request.text} failed. Please try again.\``;
    void webService.sendEphemeral(request.channel_id, errorMessage, request.user_id);
    return undefined;
  });
});
