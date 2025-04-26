import express, { Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';
import { WebService } from '../shared/services/web/web.service';
import { Block, KnownBlock } from '@slack/web-api';
import { QuoteService } from './quote.service';
import { QuoteData } from './quote.models';

export const quoteController: Router = express.Router();

const suppressorService = new SuppressorService();
const quoteService = QuoteService.getInstance();
const webService = WebService.getInstance();

const getEmoji = (delta: string): string => {
  if (parseFloat(delta) > 0) {
    return ':chart_with_upwards_trend:';
  } else if (parseFloat(delta) < 0) {
    return ':chart_with_downwards_trend:';
  }
  return ':chart:';
};

const getPlusOrMinus = (delta: string): string => {
  if (parseFloat(delta) > 0) {
    return '+';
  }
  return '';
};

const getPlusOrMinusPercent = (delta: string): string => {
  if (parseFloat(delta) > 0) {
    return '+';
  } else {
    return '';
  }
};

const createQuoteBlocks = (quote: QuoteData, userId: string): Block[] | KnownBlock[] | undefined => {
  console.log(quote);
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${quote.ticker.toUpperCase()}  ${quote.name ? `- ${quote.name} ` : ''}${getEmoji(quote.delta)}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Latest Price*: $${quote.close}`,
        },
        {
          type: 'mrkdwn',
          text: `*Price Change*: ${getPlusOrMinus(quote.delta)}$${quote.delta} (${getPlusOrMinusPercent(quote.delta) + quote.deltaPercent})`,
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Previous Close*: $${quote.prevClose}`,
        },
        {
          type: 'mrkdwn',
          text: `*Market Cap*: $${quote.marketCap}`,
        },
        {
          type: 'mrkdwn',
          text: `*Today's High*: $${quote.high}`,
        },
        {
          type: 'mrkdwn',
          text: `*Today's Low*: $${quote.low}`,
        },
        {
          type: 'mrkdwn',
          text: `*52 Week High*: $${quote['52WeekHigh']}`,
        },
        {
          type: 'mrkdwn',
          text: `*52 Week Low*: $${quote['52WeekLow']}`,
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `:moneybag: Quote requested by <@${userId}> :moneybag:`,
          verbatim: false,
        },
      ],
    },
  ];
};
quoteController.post('/quote', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text || request.text.length > 4) {
    res.send('Sorry, you must provide a stock ticker in order to use /quote.');
  } else {
    res.status(200).send();
    const quote: QuoteData = await quoteService.quote(request.text.toUpperCase());
    webService.sendMessage(request.channel_id, '', createQuoteBlocks(quote, request.user_id)).catch((e) => {
      console.error(e);
      webService.sendMessage(
        request.user_id,
        'Sorry, unable to send the requested text to Slack. You have been credited for your Moon Token. Perhaps you were trying to send in a private channel? If so, invite @MoonBeam and try again.',
      );
    });
  }
});
