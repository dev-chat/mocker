import type { Router } from 'express';
import express from 'express';
import { DashboardPersistenceService } from './dashboard.persistence.service';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';
import type { RequestWithAuthSession } from '../shared/models/express/RequestWithAuthSession';
import { DEFAULT_PERIOD, VALID_PERIODS } from './dashboard.const';
import type { TimePeriod } from './dashboard.model';
import { MemoryPersistenceService } from '../ai/memory/memory.persistence.service';
import { TraitPersistenceService } from '../trait/trait.persistence.service';

export const dashboardController: Router = express.Router();

const dashboardPersistenceService = new DashboardPersistenceService();
const memoryPersistenceService = new MemoryPersistenceService();
const traitPersistenceService = new TraitPersistenceService();
const dashboardLogger = logger.child({ module: 'DashboardController' });

function parsePeriod(value: unknown): TimePeriod {
  for (const p of VALID_PERIODS) {
    if (p === value) return p;
  }
  return DEFAULT_PERIOD;
}

dashboardController.get('/', (req: RequestWithAuthSession, res) => {
  const { teamId, userId } = req.authSession || {};

  if (!teamId || !userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const period = parsePeriod(req.query.period);

  dashboardPersistenceService
    .getDashboardData(userId, teamId, period)
    .then((data) => res.status(200).json(data))
    .catch((e: unknown) => {
      logError(dashboardLogger, 'Failed to load dashboard data', e, { userId, teamId });
      res.status(500).send();
    });
});

dashboardController.get('/personal-context', (req: RequestWithAuthSession, res) => {
  const { teamId, userId } = req.authSession || {};

  if (!teamId || !userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  Promise.all([
    memoryPersistenceService.getAllMemoriesForUser(userId, teamId),
    traitPersistenceService.getAllTraitsForUser(userId, teamId),
  ])
    .then(([memories, traits]) => {
      res.status(200).json({
        memories: memories.map((memory) => ({
          id: memory.id,
          content: memory.content,
          updatedAt: new Date(memory.updatedAt).toISOString(),
        })),
        traits: traits.map((trait) => ({
          id: trait.id,
          content: trait.content,
          updatedAt: new Date(trait.updatedAt).toISOString(),
        })),
      });
    })
    .catch((e: unknown) => {
      logError(dashboardLogger, 'Failed to load personal context data', e, { userId, teamId });
      res.status(500).send();
    });
});
