import express, { Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';
import { ListService } from './list.service';

export const listController: Router = express.Router();
listController.use(suppressedMiddleware);

const listService = new ListService();

listController.post('/retrieve', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  listService.getListReport(request);
  res.status(200).send();
});

listController.post('/add', textMiddleware, async (req, res) => {
  const request: SlashCommandRequest = req.body;
  listService.list(request);
  res.status(200).send();
});

listController.post('/remove', textMiddleware, async (req, res) => {
  const request: SlashCommandRequest = req.body;
  listService.remove(request);
  res.status(200).send();
});
