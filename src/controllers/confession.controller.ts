import express, { Router } from 'express';
import { BackFirePersistenceService } from '../services/backfire/backfire.persistence.service';
import { CounterPersistenceService } from '../services/counter/counter.persistence.service';
import { MuzzlePersistenceService } from '../services/muzzle/muzzle.persistence.service';
import { WebService } from '../services/web/web.service';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';

export const confessionController: Router = express.Router();

const muzzlePersistenceService = MuzzlePersistenceService.getInstance();
const backfirePersistenceService = BackFirePersistenceService.getInstance();
const counterPersistenceService = CounterPersistenceService.getInstance();
const webService = WebService.getInstance();

confessionController.post('/confess', (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (
    muzzlePersistenceService.isUserMuzzled(request.user_id) ||
    backfirePersistenceService.isBackfire(request.user_id) ||
    counterPersistenceService.isCounterMuzzled(request.user_id)
  ) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send('Sorry, you must send a message to confess.');
  } else {
    const confession = `Someone has confessed: 
    \`${request.text}\``;
    webService.sendMessage('#confessions', confession);
    res.status(200).send();
  }
});
