import Axios from 'axios';
import type { Router } from 'express';
import express from 'express';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';
import type { RequestWithAuthSession } from '../shared/models/express/RequestWithAuthSession';
import { FantasyService, FantasyValidationError } from './fantasy.service';

export const fantasyController: Router = express.Router();
const fantasyService = new FantasyService();
const fantasyLogger = logger.child({ module: 'FantasyController' });

function getSession(req: RequestWithAuthSession): { userId: string; teamId: string } | null {
  const { userId, teamId } = req.authSession ?? {};
  return userId && teamId ? { userId, teamId } : null;
}

function handleError(
  error: unknown,
  res: Parameters<Parameters<Router['get']>[1]>[1],
  context: Record<string, unknown>,
): void {
  if (error instanceof FantasyValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (Axios.isAxiosError(error) && error.response?.status === 404) {
    res.status(404).json({ error: 'Sleeper resource was not found.' });
    return;
  }
  logError(fantasyLogger, 'Fantasy request failed', error, context);
  res.status(502).json({ error: 'Fantasy data is temporarily unavailable.' });
}

fantasyController.get('/', (req: RequestWithAuthSession, res) => {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  fantasyService
    .getLanding(session.userId, session.teamId)
    .then((data) => res.status(200).json(data))
    .catch((error: unknown) => handleError(error, res, session));
});

fantasyController.get('/leagues/:leagueId', (req: RequestWithAuthSession, res) => {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  fantasyService
    .getOverview(session.userId, session.teamId, req.params.leagueId)
    .then((overview) => {
      if (!overview) {
        res.status(404).json({ error: 'League or linked Sleeper roster was not found.' });
        return;
      }
      res.status(200).json(overview);
    })
    .catch((error: unknown) => handleError(error, res, { ...session, leagueId: req.params.leagueId }));
});
