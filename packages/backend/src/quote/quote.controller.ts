import type { Router } from 'express';
import express from 'express';
import type { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { QuoteService } from './quote.service';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';

export const quoteController: Router = express.Router();
quoteController.use(suppressedMiddleware);
quoteController.use(textMiddleware);

const quoteService = new QuoteService();
const quoteLogger = logger.child({ module: 'QuoteController' });

quoteController.post('/', (req, res) => {
  const request: SlashCommandRequest = req.body;
  res.status(200).send();
  void quoteService.quote(request.text.toUpperCase(), request.channel_id, request.user_id).catch((e) => {
    logError(quoteLogger, 'Failed to handle /quote request', e, {
      ticker: request.text.toUpperCase(),
      channelId: request.channel_id,
      userId: request.user_id,
    });
  });
});
