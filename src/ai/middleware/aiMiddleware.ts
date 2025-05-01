import { NextFunction, Request, Response } from 'express';
import { StoreService } from '../../store/store.service';
import { AIService } from '../ai.service';
import { logger } from '../../shared/logger/logger';

const aiService = new AIService();
const storeService = new StoreService();
const MOON_TOKEN_ITEM_ID = 4;
const aiMiddlewareLogger = logger.child({ module: 'AIMiddleware' });

export const aiMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { user_id, team_id } = req.body;
  const hasAvailableMoonToken = await storeService.isItemActive(user_id, team_id, MOON_TOKEN_ITEM_ID);
  const isAlreadyAtMaxRequests = await aiService.isAlreadyAtMaxRequests(user_id, team_id);
  const isAlreadyInFlight = await aiService.isAlreadyInflight(user_id, team_id);
  if (!hasAvailableMoonToken && isAlreadyAtMaxRequests) {
    aiMiddlewareLogger.info(`User ${user_id} from team ${team_id} has reached max requests without a Moon Token.`);
    res.send(
      'Sorry, you have reached your maximum number of requests per day. Try again tomorrow or consider purchasing a Moon Token in the store.',
    );
  } else if (isAlreadyInFlight) {
    aiMiddlewareLogger.info(`User ${user_id} from team ${team_id} has an in-flight request.`);
    res.send('Sorry, you already have a request in flight. Please wait for that request to complete.');
  } else if (isAlreadyAtMaxRequests && hasAvailableMoonToken) {
    aiMiddlewareLogger.info(`User ${user_id} from team ${team_id} has reached max requests but has a Moon Token.`);
    storeService.removeEffect(user_id, team_id, 4);
    next();
  } else {
    next();
  }
};
