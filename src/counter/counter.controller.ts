import express, { Router } from 'express';
import { CounterPersistenceService } from './counter.persistence.service';
import { CounterService } from './counter.service';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { suppressedMiddleware } from '../shared/middleware/suppression';

export const counterController: Router = express.Router();
counterController.use(suppressedMiddleware);

const counterPersistenceService = CounterPersistenceService.getInstance();
const counterService = new CounterService();

counterController.post('/', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (!counterPersistenceService.canCounter(request.user_id)) {
    res.send('You have lost counter privileges and cannot counter right now.');
  } else {
    await counterService
      .createCounter(request.user_id, request.team_id)
      .then((value) => res.send(value))
      .catch((e) => res.send(e));
  }
});
