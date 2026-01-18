import { NextFunction, Request, Response } from 'express';
import { logger } from '../logger/logger';

const textMiddlewareLogger = logger.child({ module: 'TextMiddleware' });

export const textMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const { text } = req.body;
  if (!text || text.length > 800) {
    textMiddlewareLogger.info(
      `Invalid request from user ${req.body.user_id} in team ${req.body.team_id}: ${text ? text.length : 'undefined'} characters.`,
    );
    res.send(`Sorry, your request must be defined and cannot be more than 800 characters.'`);
  } else {
    next();
  }
};
