import express, { Router } from 'express';
import { SlackService } from '../services/slack/slack.service';
import { ChannelResponse, SlashCommandRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';
import { QuoteService } from '../services/quote/quote.service';
import { QuoteData } from '../services/quote/quote.models';

export const quoteController: Router = express.Router();

const suppressorService = new SuppressorService();
const slackService = SlackService.getInstance();
const quoteService = QuoteService.getInstance();

quoteController.post('/quote', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send('Sorry, you must provide a stock ticker in order to use /quote.');
  } else {
    const quote: QuoteData = await quoteService.quote(request.text);
    const response: ChannelResponse = {
      attachments: [
        {
          text: quote.toString(),
        },
      ],
      response_type: 'in_channel',
      text: `<@${request.user_id}>`,
    };
    slackService.sendResponse(request.response_url, response);
    res.status(200).send();
  }
});
