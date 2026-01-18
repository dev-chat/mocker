import express, { Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { WalkieService } from './walkie.service';
import { suppressedMiddleware } from '../shared/middleware/suppression';

export const walkieController: Router = express.Router();

const walkieService = new WalkieService();

walkieController.use(suppressedMiddleware);

walkieController.post('/', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  walkieService.walkieTalkie(request);
  res.status(200).send();
});
