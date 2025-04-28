import express, { Request, Response, Router } from 'express';
import { DefineService } from './define.service';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';

export const defineController: Router = express.Router();
defineController.use(suppressedMiddleware);
defineController.use(textMiddleware);

const defineService = DefineService.getInstance();

defineController.post('/define', async (req: Request, res: Response) => {
  const { user_id, channel_id, text} = req.body;
  res.status(200).send();
  defineService.define(text, user_id, channel_id).catch(e => {
    console.error(e);
    res.send('Something went wrong while retrieving your definition');
  });
});
