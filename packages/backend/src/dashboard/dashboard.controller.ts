import type { Router } from 'express';
import express from 'express';
import { DashboardPersistenceService } from './dashboard.persistence.service';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';
import type { RequestWithAuthSession } from '../shared/models/express/RequestWithAuthSession';

export const dashboardController: Router = express.Router();

const dashboardPersistenceService = new DashboardPersistenceService();
const dashboardLogger = logger.child({ module: 'DashboardController' });

dashboardController.get('/', (req: RequestWithAuthSession, res) => {
  const teamId = req.authSession?.teamId;
  const userId = req.authSession?.userId;

  if (!teamId || !userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  dashboardPersistenceService
    .getDashboardData(userId, teamId)
    .then((data) => res.status(200).json(data))
    .catch((e: unknown) => {
      logError(dashboardLogger, 'Failed to load dashboard data', e, { userId, teamId });
      res.status(500).send();
    });
});
