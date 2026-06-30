import type { Response, NextFunction } from 'express';
import { verifySessionToken } from '../utils/session-token';
import { BEARER_PREFIX_LENGTH } from '../utils/session-token.const';
import { logger } from '../logger/logger';
import type { RequestWithAuthSession } from '../models/express/RequestWithAuthSession';
import { SESSION_COOKIE } from '../../auth/auth.const';

const authLogger = logger.child({ module: 'AuthMiddleware' });

function getCookieValue(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  const match = cookieHeader.split(';').find((cookie) => cookie.trim().startsWith(`${name}=`));
  if (!match) {
    return undefined;
  }

  return match.split('=').slice(1).join('=');
}

export const authMiddleware = (req: RequestWithAuthSession, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(BEARER_PREFIX_LENGTH) : undefined;
  const cookieToken = getCookieValue(req.headers.cookie, SESSION_COOKIE);
  const token = bearerToken ?? cookieToken;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  let session: ReturnType<typeof verifySessionToken>;
  try {
    session = verifySessionToken(token);
  } catch {
    authLogger.error('Session token verification failed — SESSION_SECRET or SEARCH_AUTH_SECRET may not be set');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!session) {
    authLogger.warn('Invalid or expired session token');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!session.teamId) {
    authLogger.warn('Session token missing teamId; rejecting request');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  req.authSession = session;

  next();
};
