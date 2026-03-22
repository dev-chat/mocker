import type { Router } from 'express';
import express from 'express';
import type { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';
import { ListService } from './list.service';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';

export const listController: Router = express.Router();
listController.use(suppressedMiddleware);

const listService = new ListService();
const listLogger = logger.child({ module: 'ListController' });

listController.post('/retrieve', (req, res) => {
  const request: SlashCommandRequest = req.body;
  void Promise.resolve(listService.getListReport(request)).catch((e) => {
    logError(listLogger, 'Failed to retrieve list report', e, {
      userId: request.user_id,
      teamId: request.team_id,
      channelId: request.channel_id,
      channelName: request.channel_name,
    });
  });
  res.status(200).send();
});

listController.post('/add', textMiddleware, (req, res) => {
  const request: SlashCommandRequest = req.body;
  void Promise.resolve(listService.list(request)).catch((e) => {
    logError(listLogger, 'Failed to add list item', e, {
      userId: request.user_id,
      teamId: request.team_id,
      channelId: request.channel_id,
      text: request.text,
    });
  });
  res.status(200).send();
});

listController.post('/remove', textMiddleware, (req, res) => {
  const request: SlashCommandRequest = req.body;
  void Promise.resolve(listService.remove(request)).catch((e) => {
    logError(listLogger, 'Failed to remove list item', e, {
      userId: request.user_id,
      teamId: request.team_id,
      channelId: request.channel_id,
      text: request.text,
    });
  });
  res.status(200).send();
});
