import express, { Router } from 'express';
import { CounterPersistenceService } from '../services/counter/counter.persistence.service';
import { CounterService } from '../services/counter/counter.service';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';

export const counterController: Router = express.Router();

const suppressorService = new SuppressorService();
const counterPersistenceService = CounterPersistenceService.getInstance();
const counterService = new CounterService();

counterController.post('/counter', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id)) {
    res.send(
      "You can't counter someone if you are already muzzled, currently have a counter, or have lost counter privileges!",
    );
  } else if (!counterPersistenceService.canCounter(request.user_id)) {
    res.send('You have lost counter privileges and cannot counter right now.');
  } else {
    await counterService
      .createCounter(request.user_id)
      .then(value => res.send(value))
      .catch(e => res.send(e));
  }
});
