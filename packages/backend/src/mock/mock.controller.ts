import type { Router } from 'express';
import express from 'express';
import { MockService } from './mock.service';
import type { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';

export const mockController: Router = express.Router();

mockController.use(suppressedMiddleware);
mockController.use(textMiddleware);

const mockService = new MockService();
const mockLogger = logger.child({ module: 'MockController' });

mockController.post('/', (req, res) => {
  const request: SlashCommandRequest = req.body;
  void Promise.resolve(mockService.mock(request)).catch((e) => {
    logError(mockLogger, 'Failed to handle /mock request', e, {
      userId: request.user_id,
      responseUrl: request.response_url,
      text: request.text,
    });
  });
  res.status(200).send();
});
