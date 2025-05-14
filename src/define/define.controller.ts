import express, { Request, Response, Router } from 'express';
import { DefineService } from './define.service';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';
import { logger } from '../shared/logger/logger';

export const defineController: Router = express.Router();
defineController.use(suppressedMiddleware);
defineController.use(textMiddleware);

const defineService = new DefineService();
const defineLogger = logger.child({ module: 'DefineController' });

defineController.post('/', async (req: Request, res: Response) => {
  const { user_id, channel_id, text } = req.body;
  res.status(200).send();
  defineService.define(text, user_id, channel_id).catch((e) => {
    defineLogger.error(e);
    res.send('Something went wrong while retrieving your definition');
  });
});
