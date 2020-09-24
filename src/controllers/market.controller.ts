import express, { Request, Response, Router } from 'express';
import { ChannelResponse, SlashCommandRequest } from '../shared/models/slack/slack-models';

export const marketController: Router = express.Router();

marketController.post('/portfolio', async (req: Request, res: Response) => {
  const request: SlashCommandRequest = req.body;
});

marketController.post('/pbuy', async (req: Request, res: Response) => {
  const request: SlashCommandRequest = req.body;
});

marketController.post('/psell', async (req: Request, res: Response) => {
  const request: SlashCommandRequest = req.body;
});
