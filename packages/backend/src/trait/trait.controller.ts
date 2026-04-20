import type { Router } from 'express';
import express from 'express';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { TraitService } from './trait.service';

export const traitController: Router = express.Router();

const traitService = new TraitService();

traitController.use(suppressedMiddleware);

traitController.post('/', (req, res) => {
  const { user_id, team_id, channel_id } = req.body;

  // Respond immediately — Slack requires a response within 3 seconds
  res.status(200).send('');

  void traitService.sendTraitsForUser(user_id, team_id, channel_id);
});
