import express, { Router } from 'express';
import { ConfessionService } from './confession.service';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';

export const confessionController: Router = express.Router();
confessionController.use(suppressedMiddleware);
confessionController.use(textMiddleware);

const confessionService = new ConfessionService();

confessionController.post('/confess', async (req, res) => {
  res.status(200).send();
  const { user_id, team_id, channel_id, text } = req.body;
  confessionService.confess(user_id, team_id, channel_id, text);
});
