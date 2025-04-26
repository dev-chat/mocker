import { NextFunction, Request, Response } from 'express';
import { StoreService } from '../../store/store.service';
import { AIService } from '../ai.service';

const aiService = new AIService();
const storeService = new StoreService();
const MOON_TOKEN_ITEM_ID = 4;

export const aiMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const { user_id, team_id } = req.body;
  const hasAvailableMoonToken = await storeService.isItemActive(user_id, team_id, MOON_TOKEN_ITEM_ID);
  const isAlreadyAtMaxRequests = await aiService.isAlreadyAtMaxRequests(user_id, team_id);
  const isAlreadyInFlight = await aiService.isAlreadyInflight(user_id, team_id);
  if (!hasAvailableMoonToken && isAlreadyAtMaxRequests) {
    res.send(
      'Sorry, you have reached your maximum number of requests per day. Try again tomorrow or consider purchasing a Moon Token in the store.',
    );
  } else if (isAlreadyInFlight) {
    res.send('Sorry, you already have a request in flight. Please wait for that request to complete.');
  } if (isAlreadyAtMaxRequests && hasAvailableMoonToken) {
    storeService.removeEffect(user_id, team_id, 4);
  } else {
    next();
  }
};
