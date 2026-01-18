import { Request, Response, NextFunction } from 'express';
import { SearchAuthService, JWTPayload } from './search.auth.service';
import { logger } from '../shared/logger/logger';

const authLogger = logger.child({ module: 'SearchAuthMiddleware' });
const authService = new SearchAuthService();

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export const searchAuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);
  const payload = authService.verifyJWT(token);

  if (!payload) {
    authLogger.debug('Invalid or expired token');
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = payload;
  next();
};
