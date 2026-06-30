import type { Router } from 'express';
import express from 'express';
import {
  ActiveTimerExistsError,
  ActiveTimerNotFoundError,
  BathroomUserNotFoundError,
  BathroomPersistenceService,
} from './bathroom.persistence.service';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';
import type { RequestWithAuthSession } from '../shared/models/express/RequestWithAuthSession';

export const bathroomController: Router = express.Router();

const bathroomPersistenceService = new BathroomPersistenceService();
const bathroomLogger = logger.child({ module: 'BathroomController' });

function parseRequestedDate(input: unknown): Date | null {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return null;
  }

  const parsed = new Date(`${input}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTimer(timer: { id: number; startAt: Date; endAt: Date | null; durationSeconds: number | null }) {
  return {
    id: timer.id,
    start_at: timer.startAt.toISOString(),
    end_at: timer.endAt?.toISOString() ?? null,
    duration_seconds: timer.durationSeconds,
  };
}

bathroomController.get('/me', (req: RequestWithAuthSession, res) => {
  const slackId = req.authSession?.userId;

  if (!slackId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  Promise.all([
    bathroomPersistenceService.getUserBySlackId(slackId),
    bathroomPersistenceService.getActiveTimerForSlackUser(slackId),
  ])
    .then(([user, activeTimer]) => {
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.status(200).json({
        user: {
          slack_id: user.slackId,
          display_name: user.displayName,
          avatar_url: user.avatarUrl,
        },
        active_timer: activeTimer ? formatTimer(activeTimer) : null,
      });
    })
    .catch((e: unknown) => {
      logError(bathroomLogger, 'Failed to load bathroom timer state', e, { slackId });
      res.status(500).json({ error: 'Failed to load timer state' });
    });
});

bathroomController.post('/timer/start', (req: RequestWithAuthSession, res) => {
  const slackId = req.authSession?.userId;

  if (!slackId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  bathroomPersistenceService
    .startTimer(slackId)
    .then((timer) => res.status(201).json(formatTimer(timer)))
    .catch((e: unknown) => {
      if (e instanceof ActiveTimerExistsError) {
        res.status(409).json({ error: 'Active timer already exists' });
        return;
      }
      if (e instanceof BathroomUserNotFoundError) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      logError(bathroomLogger, 'Failed to start bathroom timer', e, { slackId });
      res.status(500).json({ error: 'Failed to start timer' });
    });
});

bathroomController.post('/timer/stop', (req: RequestWithAuthSession, res) => {
  const slackId = req.authSession?.userId;

  if (!slackId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  bathroomPersistenceService
    .stopTimer(slackId)
    .then((timer) => res.status(200).json(formatTimer(timer)))
    .catch((e: unknown) => {
      if (e instanceof ActiveTimerNotFoundError) {
        res.status(404).json({ error: 'Active timer not found' });
        return;
      }

      logError(bathroomLogger, 'Failed to stop bathroom timer', e, { slackId });
      res.status(500).json({ error: 'Failed to stop timer' });
    });
});

bathroomController.get('/leaderboard', (req: RequestWithAuthSession, res) => {
  const slackId = req.authSession?.userId;

  if (!slackId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const requestedDate =
    req.query.date === undefined
      ? new Date()
      : parseRequestedDate(typeof req.query.date === 'string' ? req.query.date : '');

  if (!requestedDate) {
    res.status(400).json({ error: 'date must be provided as YYYY-MM-DD' });
    return;
  }

  bathroomPersistenceService
    .getLeaderboardForDate(requestedDate)
    .then((entries) =>
      res.status(200).json(
        entries.map((entry) => ({
          slack_id: entry.slackId,
          display_name: entry.displayName,
          total_seconds: entry.totalSeconds,
        })),
      ),
    )
    .catch((e: unknown) => {
      logError(bathroomLogger, 'Failed to load bathroom leaderboard', e, {
        slackId,
        date: requestedDate.toISOString(),
      });
      res.status(500).json({ error: 'Failed to load leaderboard' });
    });
});
