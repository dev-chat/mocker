import express, { Router } from 'express';
import { ClapService } from './clap.service';
import { textMiddleware } from '../shared/middleware/textMiddleware';
import { suppressedMiddleware } from '../shared/middleware/suppression';

export const clapController: Router = express.Router();
clapController.use(textMiddleware);
clapController.use(suppressedMiddleware);

const clapService = new ClapService();

clapController.post('/', async (req, res) => {
  const { text, user_id, response_url } = req.body;
  clapService.clap(text, user_id, response_url);
  res.status(200).send();
});
