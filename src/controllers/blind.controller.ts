import express, { Router } from 'express';
import { KnownBlock } from '@slack/web-api';
import { WebService } from '../services/web/web.service';

interface BlindRequest {
  title?: string;
  text: string;
  channel_id: string;
  token: string;
}

export const blindController: Router = express.Router();

const webService = WebService.getInstance();

blindController.post('/blind/message', async (req, res) => {
  const request: BlindRequest = req.body;

  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: request?.title ? request.title : 'A Message from JR',
        emoji: true,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `\`\`\`${request.text}\`\`\``,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `:rotating_light: _An Urgent Message from JR in the Blind_ :rotating_light:`,
        },
      ],
    },
  ];

  console.log(blocks);
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
