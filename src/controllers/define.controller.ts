import { KnownBlock } from '@slack/web-api';
import express, { Request, Response, Router } from 'express';
import { DefineService } from '../services/define/define.service';
import { WebService } from '../services/web/web.service';
import { UrbanDictionaryResponse } from '../shared/models/define/define-models';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';

export const defineController: Router = express.Router();
const suppressorService = new SuppressorService();
const webService = WebService.getInstance();
const defineService = DefineService.getInstance();

defineController.post('/define', async (req: Request, res: Response) => {
  const request: SlashCommandRequest = req.body;

  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else {
    const defined: UrbanDictionaryResponse | Error = await defineService.define(request.text).catch(e => new Error(e));
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

      definitions.map(def => blocks.push(def));

      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Definition requested by <@${request.user_id}>`,
          },
        ],
      });

      webService.sendMessage(request.channel_id, text, blocks);
    }
  }
});
