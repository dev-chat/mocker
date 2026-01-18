import { NextFunction, Request, Response } from 'express';
import { SuppressorService } from '../services/suppressor.service';
import { logger } from '../logger/logger';

const suppressedMiddlewareLogger = logger.child({ module: 'SuppressedMiddleware' });
export const suppressedMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const { user_id, team_id } = req.body;
  const suppressorService = new SuppressorService();
  const isSuppressed = await suppressorService.isSuppressed(user_id, team_id);
  if (isSuppressed) {
    suppressedMiddlewareLogger.info(`User ${user_id} from team ${team_id} is currently suppressed. Rejecting request.`);
    res.send(`Sorry, can't do that while muzzled.`);
  } else {
    next();
  }
};
