import type { Router } from 'express';
import express from 'express';
import { CounterPersistenceService } from './counter.persistence.service';
import { CounterService } from './counter.service';
import type { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';

export const counterController: Router = express.Router();
counterController.use(suppressedMiddleware);

const counterPersistenceService = CounterPersistenceService.getInstance();
const counterService = new CounterService();
const counterLogger = logger.child({ module: 'CounterController' });

counterController.post('/', (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (!counterPersistenceService.canCounter(request.user_id)) {
    res.send('You have lost counter privileges and cannot counter right now.');
  } else {
    counterService
      .createCounter(request.user_id, request.team_id)
      .then((value) => res.send(value))
      .catch((e) => {
        logError(counterLogger, 'Failed to create counter', e, {
          requestorId: request.user_id,
          teamId: request.team_id,
        });
        res.send(e);
      });
  }
});
