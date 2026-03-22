import type { Router } from 'express';
import express from 'express';
import type { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';
import { PortfolioService } from './portfolio.service';
import { TransactionType } from './portfolio.persistence.service';
import { WebService } from '../shared/services/web/web.service';
import { logError } from '../shared/logger/error-logging';
import { logger as loglib } from '../shared/logger/logger';
import Decimal from 'decimal.js';

export const portfolioController: Router = express.Router();

const logger = loglib.child({ module: 'PortfolioController' });

const portfolioService = new PortfolioService();
const webService = new WebService();

portfolioController.post('/buy', suppressedMiddleware, textMiddleware, (req, res) => {
  const request: SlashCommandRequest = req.body;
  res.status(200).send();
  void portfolioService
    .transact(
      request.user_id,
      request.team_id,
      request.text.split(' ')[0].toUpperCase(),
      parseInt(request.text.split(' ')[1], 10),
      TransactionType.BUY,
    )
    .then((response) => {
      if (response.classification === 'PUBLIC') {
        void webService.sendMessage(request.channel_id, response.message);
      } else {
        void webService.sendEphemeral(request.channel_id, response.message, request.user_id);
      }
    })
    .catch((e) => {
      logError(logger, 'Failed to process portfolio buy transaction', e, {
        userId: request.user_id,
        teamId: request.team_id,
        channelId: request.channel_id,
        symbol: request.text.split(' ')[0]?.toUpperCase(),
        quantity: parseInt(request.text.split(' ')[1], 10),
      });
    });
});

portfolioController.post('/sell', suppressedMiddleware, textMiddleware, (req, res) => {
  const request: SlashCommandRequest = req.body;
  res.status(200).send();
  void portfolioService
    .transact(
      request.user_id,
      request.team_id,
      request.text.split(' ')[0].toUpperCase(),
      parseInt(request.text.split(' ')[1], 10),
      TransactionType.SELL,
    )
    .then((response) => {
      if (response.classification === 'PUBLIC') {
        void webService.sendMessage(request.channel_id, response.message);
      } else {
        void webService.sendEphemeral(request.channel_id, response.message, request.user_id);
      }
    })
    .catch((e) => {
      logError(logger, 'Failed to process portfolio sell transaction', e, {
        userId: request.user_id,
        teamId: request.team_id,
        channelId: request.channel_id,
        symbol: request.text.split(' ')[0]?.toUpperCase(),
        quantity: parseInt(request.text.split(' ')[1], 10),
      });
    });
});

portfolioController.post('/summary', (req, res) => {
  const request: SlashCommandRequest = req.body;
  res.status(200).send();
  void portfolioService
    .getPortfolioSummaryWithQuotes(request.user_id, request.team_id)
    .then((summary) => {
      let message = `*<@${request.user_id}>'s Portfolio Summary:*\n`;
      logger.info('Portfolio summary generated', {
        context: {
          userId: request.user_id,
          teamId: request.team_id,
          positions: summary.summary.length,
        },
      });
      summary.summary.forEach((item) => {
        const currentValue = item.quantity.mul(item.currentPrice);
        const deltaText = item.costBasis ? `*Gain/Loss:* $${currentValue.minus(item.costBasis).toFixed(2)}` : '';
        message += `• *${item.symbol}*: \n`;
        message += `*Value:* $${currentValue.toFixed(2)} (${item.quantity.toFixed(2)} shares @ $${item.currentPrice.toFixed(2)}) \n`;
        message += `${deltaText} \n`;
        if (item.costBasis) {
          message += `*Cost Basis:* $${item.costBasis.toFixed(2)}`;
        }
        message += `\n`;
      });

      const unrealizedGains = summary.summary.reduce((total, item) => {
        const currentValue = item.quantity.mul(item.currentPrice);
        return total.plus(currentValue.minus(item.costBasis || 0));
      }, new Decimal(0));

      message += `\n\n*Total Portfolio Balance:* $${summary.summary
        .reduce((total, item) => {
          return total.plus(item.quantity.mul(item.currentPrice));
        }, new Decimal(0))
        .toFixed(2)}\n`;
      message += `*Unrealized Gains:* $${unrealizedGains.toFixed(2)}\n`;
      message += `*Total Dollars Available:* $${summary.rep.totalRepAvailable.toFixed(2)}\n`;
      void webService.sendEphemeral(request.channel_id, message, request.user_id);
    })
    .catch((e) => {
      logError(logger, 'Failed to generate portfolio summary', e, {
        userId: request.user_id,
        teamId: request.team_id,
        channelId: request.channel_id,
      });
    });
});
