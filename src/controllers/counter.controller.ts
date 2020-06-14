import express, { Router } from 'express';
import { BackFirePersistenceService } from '../services/backfire/backfire.persistence.service';
import { CounterPersistenceService } from '../services/counter/counter.persistence.service';
import { CounterService } from '../services/counter/counter.service';
import { MuzzlePersistenceService } from '../services/muzzle/muzzle.persistence.service';
import { SlackService } from '../services/slack/slack.service';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';

export const counterController: Router = express.Router();

const muzzlePersistenceService = MuzzlePersistenceService.getInstance();
const backFirePersistenceService = BackFirePersistenceService.getInstance();
const counterPersistnceService = CounterPersistenceService.getInstance();
const slackService = SlackService.getInstance();
const counterService = new CounterService();

counterController.post('/counter', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  const userId = slackService.getUserId(request.text);
  const counter = counterService.getCounterByRequestorAndUserId(userId, request.user_id);
  if (
    muzzlePersistenceService.isUserMuzzled(request.user_id) ||
    backFirePersistenceService.isBackfire(request.user_id) ||
    counterPersistnceService.isCounterMuzzled(request.user_id)
  ) {
    res.send("You can't counter someone if you are already muzzled!");
  } else if (!request.text) {
    res.send('Sorry, you must specify who you would like to counter in order to use this service.');
  } else if (counter) {
    counterService.removeCounter(counter, true, request.channel_name);
    res.send('Sorry, your counter has been countered.');
  } else {
    await counterService
      .createCounter(userId, request.user_id)
      .then(value => res.send(value))
      .catch(e => res.send(e));
  }
});
