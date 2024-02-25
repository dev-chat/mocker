import { KnownBlock } from '@slack/web-api';
import express, { Request, Response, Router } from 'express';
import { UrbanDictionaryResponse } from '../shared/models/define/define-models';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { getService } from '../shared/services/service.injector';

export const defineController: Router = express.Router();

defineController.post('/define', async (req: Request, res: Response) => {
  const suppressorService = getService('SuppressorService');
  const defineService = getService('DefineService');
  const webService = getService('WebService');

  const request: SlashCommandRequest = req.body;

  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else {
    const defined: UrbanDictionaryResponse | Error = await defineService
      .define(request.text)
      .catch((e) => new Error(e));
    if (defined instanceof Error) {
      res.send('Something went wrong while retrieving your definition');
    } else {
      res.status(200).send();
      const text = `${defineService.capitalizeFirstLetter(request.text)}`;
      const definitions = defineService.formatDefs(defined.list, request.text);
      const blocks: KnownBlock[] = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text,
          },
        },
      ];

      definitions.map((def) => blocks.push(def));

      blocks.push({
        type: 'divider',
      });

      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `:sparkles: _Definition requested by <@${request.user_id}>, and provided by users just like you._ :sparkles:`,
          },
        ],
      });

      webService.sendMessage(request.channel_id, text, blocks).catch((e) => console.error(e));
    }
  }
});
