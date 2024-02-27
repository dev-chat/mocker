import express, { Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { getService } from '../shared/services/service.injector';

export const counterController: Router = express.Router();

counterController.post('/counter', async (req, res) => {
  const suppressorService = getService('SuppressorService');
  const counterService = getService('CounterService');
  const counterPersistenceService = getService('CounterPersistenceService');

  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(
      "You can't counter someone if you are already muzzled, currently have a counter, or have lost counter privileges!",
    );
  } else if (!counterPersistenceService.canCounter(request.user_id)) {
    res.send('You have lost counter privileges and cannot counter right now.');
  } else {
    await counterService
      .createCounter(request.user_id, request.team_id)
      .then((value) => res.send(value))
      .catch((e) => res.send(e));
  }
});
