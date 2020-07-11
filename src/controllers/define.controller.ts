import express, { Request, Response, Router } from 'express';
import { DefineService } from '../services/define/define.service';
import { SlackService } from '../services/slack/slack.service';
import { UrbanDictionaryResponse } from '../shared/models/define/define-models';
import { ChannelResponse, SlashCommandRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';

export const defineController: Router = express.Router();
const suppressorService = new SuppressorService();
const slackService = SlackService.getInstance();
const defineService = DefineService.getInstance();

defineController.post('/define', async (req: Request, res: Response) => {
  const request: SlashCommandRequest = req.body;

  if (await suppressorService.isSuppressed(request.user_id)) {
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
