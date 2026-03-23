import type { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from '../utils/session-token';
import { logger } from '../logger/logger';

const authLogger = logger.child({ module: 'AuthMiddleware' });

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7);
  const session = verifySessionToken(token);
  if (!session) {
    authLogger.warn('Invalid or expired session token');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
};
