import type { Router } from 'express';
import express from 'express';
import type { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';
import { ListService } from './list.service';

export const listController: Router = express.Router();
listController.use(suppressedMiddleware);

const listService = new ListService();

listController.post('/retrieve', (req, res) => {
  const request: SlashCommandRequest = req.body;
  void listService.getListReport(request);
  res.status(200).send();
});

listController.post('/add', textMiddleware, (req, res) => {
  const request: SlashCommandRequest = req.body;
  void listService.list(request);
  res.status(200).send();
});

listController.post('/remove', textMiddleware, (req, res) => {
  const request: SlashCommandRequest = req.body;
  void listService.remove(request);
  res.status(200).send();
});
