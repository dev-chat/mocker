import express, { Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { QuoteService } from './quote.service';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';

export const quoteController: Router = express.Router();
quoteController.use(suppressedMiddleware);
quoteController.use(textMiddleware);

const quoteService = new QuoteService();

quoteController.post('/', (req, res) => {
  const request: SlashCommandRequest = req.body;
  res.status(200).send();
  quoteService.quote(request.text.toUpperCase(), request.channel_id, request.user_id);
});
