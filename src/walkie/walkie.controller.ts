import express, { Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { WalkieService } from './walkie.service';

export const walkieController: Router = express.Router();

const walkieService = new WalkieService();

walkieController.post('/walkie', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  walkieService.walkieTalkie(request);
  res.status(200).send();
});
