import express, { Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';
import { PortfolioService } from './portfolio.service';
import { TransactionType } from './portfolio.persistence.service';
import { WebService } from '../shared/services/web/web.service';

export const portfolioController: Router = express.Router();

const portfolioService = new PortfolioService();
const webService = new WebService();

portfolioController.post('/buy', suppressedMiddleware, textMiddleware, (req, res) => {
  const request: SlashCommandRequest = req.body;
  res.status(200).send();
  portfolioService
    .transact(
      request.user_id,
      request.team_id,
      request.text.split(' ')[0].toUpperCase(),
      parseInt(request.text.split(' ')[1], 10),
      TransactionType.BUY,
    )
    .then((response) => {
      if (response.classification === 'PUBLIC') {
        webService.sendMessage(request.channel_id, response.message);
      } else {
        webService.sendEphemeral(request.channel_id, response.message, request.user_id);
      }
    });
});

portfolioController.post('/sell', suppressedMiddleware, textMiddleware, (req, res) => {
  const request: SlashCommandRequest = req.body;
  res.status(200).send();
  portfolioService
    .transact(
      request.user_id,
      request.team_id,
      request.text.split(' ')[0].toUpperCase(),
      parseInt(request.text.split(' ')[1], 10),
      TransactionType.SELL,
    )
    .then((response) => {
      if (response.classification === 'PUBLIC') {
        webService.sendMessage(request.channel_id, response.message);
      } else {
        webService.sendEphemeral(request.channel_id, response.message, request.user_id);
      }
    });
});

portfolioController.post('/summary', (req, res) => {
  const request: SlashCommandRequest = req.body;
  res.status(200).send();
  portfolioService.getPortfolioSummaryWithQuotes(request.user_id, request.team_id).then((summary) => {
    let message = `*<@${request.user_id}>'s Portfolio Summary:*\n`;
    summary.summary.forEach((item) => {
      message += `• *${item.symbol}*: ${item.quantity} shares @ $${item.currentPrice.toFixed(2)} = $${(item.quantity * item.currentPrice).toFixed(2)}`;
      if (item.costBasis) {
        message += ` (Cost Basis: $${item.costBasis.toFixed(2)})`;
      }
      message += `\n`;
    });
    webService.sendEphemeral(request.channel_id, message, request.user_id);
  });
});
