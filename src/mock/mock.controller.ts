import express, { Router } from 'express';
import { MockService } from './mock.service';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';

export const mockController: Router = express.Router();

mockController.use(suppressedMiddleware);
mockController.use(textMiddleware);

const mockService = new MockService();

mockController.post('/', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  mockService.mock(request);
  res.status(200).send();
});
