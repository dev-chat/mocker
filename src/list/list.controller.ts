import express, { Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';
import { ListService } from './list.service';

export const listController: Router = express.Router();
listController.use(suppressedMiddleware);
listController.use(textMiddleware);

const listService = new ListService();

listController.post('/list/retrieve', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  listService.getListReport(request)
  res.status(200).send();
});

listController.post('/list/add', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  listService.list(request);
  res.status(200).send();
});

listController.post('/list/remove', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  listService.remove(request);
  res.status(200).send();
});
