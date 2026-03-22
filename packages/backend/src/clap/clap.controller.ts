import type { Router } from 'express';
import express from 'express';
import { ClapService } from './clap.service';
import { textMiddleware } from '../shared/middleware/textMiddleware';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';

export const clapController: Router = express.Router();
clapController.use(textMiddleware);
clapController.use(suppressedMiddleware);

const clapService = new ClapService();
const clapLogger = logger.child({ module: 'ClapController' });

clapController.post('/', (req, res) => {
  const { text, user_id, response_url } = req.body;
  void Promise.resolve(clapService.clap(text, user_id, response_url)).catch((e) => {
    logError(clapLogger, 'Failed to handle /clap request', e, {
      userId: user_id,
      responseUrl: response_url,
      text,
    });
  });
  res.status(200).send();
});
