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
import { TraitPersistenceService } from './trait/trait.persistence.service';

export const aiController: Router = express.Router();

const webService = new WebService();
const aiService = new AIService();
const traitPersistenceService = new TraitPersistenceService();
const aiLogger = logger.child({ module: 'AIController' });

aiController.use(suppressedMiddleware);
aiController.use(textMiddleware);
aiController.use(aiMiddleware);

aiController.post('/set-prompt', (req, res) => {
  const { user_id, team_id, text } = req.body;

  if (text.trim().toLowerCase() === 'clear') {
    void aiService.clearCustomPrompt(user_id, team_id).then((success) => {
      if (success) {
        res.send('Your custom prompt has been cleared. Moonbeam will use the default instructions.');
      } else {
        res.send('Failed to clear your custom prompt. Please try again.');
      }
    });
    return;
  }

  void aiService.setCustomPrompt(user_id, team_id, text.trim()).then((success) => {
    if (success) {
      res.send(`Your custom prompt has been set.`);
    } else {
      res.send('Failed to set your custom prompt. Please try again.');
    }
  });
});

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

aiController.post('/traits', (req, res) => {
  const { user_id, team_id, channel_id } = req.body;

  // Respond immediately — Slack requires a response within 3 seconds
  res.status(200).send('');

  void (async () => {
    try {
      const traits = await traitPersistenceService.getAllTraitsForUser(user_id, team_id);

      if (traits.length === 0) {
        void webService.sendEphemeral(channel_id, "Moonbeam doesn't have any core traits about you yet.", user_id);
        return;
      }

      const formattedTraits = traits
        .map((trait, index) => {
          const date = new Date(trait.updatedAt).toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
          });
          return `${index + 1}. "${trait.content}" (${date.toLowerCase()})`;
        })
        .join('\n');

      const message = `Moonbeam's core traits about you:\n${formattedTraits}`;
      void webService.sendEphemeral(channel_id, message, user_id);
    } catch (e) {
      logError(aiLogger, 'Failed to fetch traits for /ai/traits command', e, {
        userId: user_id,
        teamId: team_id,
        channelId: channel_id,
      });
      void webService.sendEphemeral(channel_id, 'Sorry, something went wrong fetching your traits.', user_id);
    }
  })();
});
