import express, { Router } from 'express';
import { WebService } from '../shared/services/web/web.service';

interface HookContent {
  key?: string;
  value?: unknown;
}

export const hookController: Router = express.Router();
const webService = new WebService();
const hookLogger = webService.logger.child({ module: 'HookController' });

hookController.post('/', async (req, res) => {
  const { body } = req;
  if (!body?.length) {
    hookLogger.info(`Invalid request: missing body.`);
    res.status(400).send('Sorry, your request is missing a body.');
    return;
  }
  const message = body.map((item: HookContent) => `${item?.key}: ${item?.value}`).join('\n');

  webService
    .sendMessage('#products', message)
    .then(() => {
      res.status(200).send();
    })
    .catch((e) => {
      res.status(500).send(`Error sending message: ${e.message}`);
    });
});
