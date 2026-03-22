import type { Request, Response, Router } from 'express';
import express from 'express';
import { DefineService } from './define.service';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';

export const defineController: Router = express.Router();
defineController.use(suppressedMiddleware);
defineController.use(textMiddleware);

const defineService = new DefineService();
const defineLogger = logger.child({ module: 'DefineController' });

defineController.post('/', (req: Request, res: Response) => {
  const { user_id, channel_id, text } = req.body;
  res.status(200).send();
  defineService.define(text, user_id, channel_id).catch((e) => {
    logError(defineLogger, 'Failed to handle /define request', e, {
      userId: user_id,
      channelId: channel_id,
      text,
    });
    res.send('Something went wrong while retrieving your definition');
  });
});
