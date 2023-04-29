import express, { Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { KnownBlock } from '@slack/web-api';
import { WebService } from '../services/web/web.service';

export const blindController: Router = express.Router();

const webService = WebService.getInstance();

blindController.post('/blind/message', async (req, res) => {
  const request: SlashCommandRequest = req.body;

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${req.body.text}*`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `:siren: *An important message from JR in the Blind*:siren:`,
        },
      ],
    },
  ];
  webService
    .sendMessage(request.channel_id, request.text, blocks)
    .then(x => {
      res.status(200).send({ message: x });
    })
    .catch(e => {
      console.error(e);
      res.status(500).send({ message: e });
    });
});
