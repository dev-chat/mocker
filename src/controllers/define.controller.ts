import express, { Request, Response, Router } from 'express';
import { BackFirePersistenceService } from '../services/backfire/backfire.persistence.service';
import { CounterPersistenceService } from '../services/counter/counter.persistence.service';
import { DefineService } from '../services/define/define.service';
import { MuzzlePersistenceService } from '../services/muzzle/muzzle.persistence.service';
import { SlackService } from '../services/slack/slack.service';
import { UrbanDictionaryResponse } from '../shared/models/define/define-models';
import { ChannelResponse, SlashCommandRequest } from '../shared/models/slack/slack-models';

export const defineController: Router = express.Router();
const muzzlePersistenceService = MuzzlePersistenceService.getInstance();
const backfirePersistenceService = BackFirePersistenceService.getInstance();
const counterPersistenceService = CounterPersistenceService.getInstance();
const slackService = SlackService.getInstance();
const defineService = DefineService.getInstance();

defineController.post('/define', async (req: Request, res: Response) => {
  const request: SlashCommandRequest = req.body;

  if (
    (await muzzlePersistenceService.isUserMuzzled(request.user_id)) ||
    (await backfirePersistenceService.isBackfire(request.user_id)) ||
    (await counterPersistenceService.isCounterMuzzled(request.user_id))
  ) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else {
    const defined: UrbanDictionaryResponse | Error = await defineService.define(request.text).catch(e => new Error(e));
    if (defined instanceof Error) {
      res.send('Something went wrong while retrieving your definition');
    } else {
      res.status(200).send();
      const response: ChannelResponse = {
        // eslint-disable-next-line @typescript-eslint/camelcase
        response_type: 'in_channel',
        text: `*${defineService.capitalizeFirstLetter(request.text)}*`,
        attachments: defineService.formatDefs(defined.list, request.text),
      };
      slackService.sendResponse(request.response_url, response);
    }
  }
});
