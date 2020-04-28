import express, { Router } from 'express';
import { BackFirePersistenceService } from '../services/backfire/backfire.persistence.service';
import { ClapService } from '../services/clap/clap.service';
import { CounterPersistenceService } from '../services/counter/counter.persistence.service';
import { MuzzlePersistenceService } from '../services/muzzle/muzzle.persistence.service';
import { SlackService } from '../services/slack/slack.service';
import { ChannelResponse, SlashCommandRequest } from '../shared/models/slack/slack-models';

export const clapController: Router = express.Router();

const muzzlePersistenceService = MuzzlePersistenceService.getInstance();
const backfirePersistenceService = BackFirePersistenceService.getInstance();
const counterPersistenceService = CounterPersistenceService.getInstance();
const slackService = SlackService.getInstance();
const clapService = new ClapService();

clapController.post('/clap', (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (
    muzzlePersistenceService.isUserMuzzled(request.user_id) ||
    backfirePersistenceService.isBackfire(request.user_id) ||
    counterPersistenceService.isCounterMuzzled(request.user_id)
  ) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send('Sorry, you must send a message to clap.');
  } else {
    const clapped: string = clapService.clap(request.text);
    const response: ChannelResponse = {
      attachments: [
        {
          text: clapped,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/camelcase
      response_type: 'in_channel',
      text: `<@${request.user_id}>`,
    };
    slackService.sendResponse(request.response_url, response);
    res.status(200).send();
  }
});
