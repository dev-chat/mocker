import type { Router } from 'express';
import express from 'express';
import { logError } from '../shared/logger/error-logging';
import { WebService } from '../shared/services/web/web.service';

export const hookController: Router = express.Router();
const webService = new WebService();
const hookLogger = webService.logger.child({ module: 'HookController' });

hookController.post('/', (req, res) => {
  const { message } = req.body;
  if (!message?.length) {
    hookLogger.info(`Invalid request: missing message.`);
    res.status(400).send('Sorry, your request is missing a message.');
    return;
  }

  webService
    .sendMessage('#products', message)
    .then(() => {
      res.status(200).send();
    })
    .catch((e) => {
      logError(hookLogger, 'Failed to send hook message', e, {
        message,
        destination: '#products',
      });
      res.status(500).send(`Error sending message: ${e.message}`);
    });
});
