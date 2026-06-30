import type { Request, Response, Router } from 'express';
import express from 'express';
import {
  ActiveTimerExistsError,
  ActiveTimerNotFoundError,
  BathroomPersistenceService,
} from './bathroom.persistence.service';
import type { ChannelResponse, SlashCommandRequest } from '../shared/models/slack/slack-models';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';

type BathroomLeaderboardScope = 'daily' | 'weekly' | 'monthly' | 'lifetime';

interface BathroomLeaderboardSection {
  scope: BathroomLeaderboardScope;
  title: string;
  entries: Array<{ displayName: string; totalSeconds: number }>;
}

export const bathroomCommandController: Router = express.Router();
bathroomCommandController.use(suppressedMiddleware);

const bathroomPersistenceService = new BathroomPersistenceService();
const bathroomCommandLogger = logger.child({ module: 'BathroomCommandController' });

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(date: Date): Date {
  const dayOfWeek = date.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday));
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(' ');
}

function parseRequestedScope(text: string): BathroomLeaderboardScope[] | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return ['daily', 'weekly', 'monthly', 'lifetime'];
  }

  if (normalized === 'all') {
    return ['daily', 'weekly', 'monthly', 'lifetime'];
  }

  if (normalized === 'daily' || normalized === 'weekly' || normalized === 'monthly' || normalized === 'lifetime') {
    return [normalized];
  }

  return null;
}

function leaderboardRange(scope: Exclude<BathroomLeaderboardScope, 'lifetime'>, now: Date): { start: Date; end: Date } {
  if (scope === 'daily') {
    const start = startOfUtcDay(now);
    return { start, end: addUtcDays(start, 1) };
  }

  if (scope === 'weekly') {
    const start = startOfUtcWeek(now);
    return { start, end: addUtcDays(start, 7) };
  }

  const start = startOfUtcMonth(now);
  return {
    start,
    end: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)),
  };
}

function leaderboardTitle(scope: BathroomLeaderboardScope): string {
  if (scope === 'daily') {
    return 'Daily';
  }
  if (scope === 'weekly') {
    return 'Weekly';
  }
  if (scope === 'monthly') {
    return 'Monthly';
  }
  return 'Lifetime';
}

function formatLeaderboardSection(section: BathroomLeaderboardSection): string {
  if (section.entries.length === 0) {
    return `*${section.title}*\n_No completed bathroom sessions yet._`;
  }

  const rows = section.entries.map(
    (entry, index) => `${index + 1}. ${entry.displayName} — ${formatDuration(entry.totalSeconds)}`,
  );
  return `*${section.title}*\n${rows.join('\n')}`;
}

function sendSlackResponse(res: Response, response: ChannelResponse): void {
  res.status(200).json(response);
}

async function upsertSlashCommandUser(request: SlashCommandRequest): Promise<void> {
  await bathroomPersistenceService.upsertUser({
    slackId: request.user_id,
    displayName: request.user_name || request.user_id,
    avatarUrl: null,
  });
}

bathroomCommandController.post('/start', (req: Request, res: Response) => {
  const request: SlashCommandRequest = req.body;

  void upsertSlashCommandUser(request)
    .then(() => bathroomPersistenceService.startTimer(request.user_id))
    .then(() =>
      sendSlackResponse(res, {
        response_type: 'ephemeral',
        text: 'Bathroom timer started.',
      }),
    )
    .catch((e: unknown) => {
      if (e instanceof ActiveTimerExistsError) {
        sendSlackResponse(res, {
          response_type: 'ephemeral',
          text: 'You already have an active bathroom timer.',
        });
        return;
      }

      logError(bathroomCommandLogger, 'Failed to start bathroom timer from Slack command', e, {
        userId: request.user_id,
        teamId: request.team_id,
        command: request.command,
      });
      res.status(500).send('Failed to start bathroom timer.');
    });
});

bathroomCommandController.post('/stop', (req: Request, res: Response) => {
  const request: SlashCommandRequest = req.body;

  void bathroomPersistenceService
    .stopTimer(request.user_id)
    .then((timer) =>
      sendSlackResponse(res, {
        response_type: 'ephemeral',
        text: `Bathroom timer stopped. Total time: ${formatDuration(timer.durationSeconds ?? 0)}.`,
      }),
    )
    .catch((e: unknown) => {
      if (e instanceof ActiveTimerNotFoundError) {
        sendSlackResponse(res, {
          response_type: 'ephemeral',
          text: 'You do not have an active bathroom timer.',
        });
        return;
      }

      logError(bathroomCommandLogger, 'Failed to stop bathroom timer from Slack command', e, {
        userId: request.user_id,
        teamId: request.team_id,
        command: request.command,
      });
      res.status(500).send('Failed to stop bathroom timer.');
    });
});

bathroomCommandController.post('/bathroom', (req: Request, res: Response) => {
  const request: SlashCommandRequest = req.body;
  const scopes = parseRequestedScope(request.text);

  if (!scopes) {
    sendSlackResponse(res, {
      response_type: 'ephemeral',
      text: 'Usage: /bathroom [daily|weekly|monthly|lifetime|all]',
    });
    return;
  }

  const now = new Date();

  void Promise.all(
    scopes.map(async (scope): Promise<BathroomLeaderboardSection> => {
      if (scope === 'lifetime') {
        const entries = await bathroomPersistenceService.getLifetimeLeaderboard();
        return {
          scope,
          title: leaderboardTitle(scope),
          entries,
        };
      }

      const { start, end } = leaderboardRange(scope, now);
      const entries = await bathroomPersistenceService.getLeaderboardForRange(start, end);
      return {
        scope,
        title: leaderboardTitle(scope),
        entries,
      };
    }),
  )
    .then((sections) =>
      sendSlackResponse(res, {
        response_type: 'in_channel',
        text: [
          ':toilet: Bathroom leaderboards _(UTC, sorted least to most total time)_',
          ...sections.map(formatLeaderboardSection),
        ].join('\n\n'),
      }),
    )
    .catch((e: unknown) => {
      logError(bathroomCommandLogger, 'Failed to load bathroom leaderboard from Slack command', e, {
        userId: request.user_id,
        teamId: request.team_id,
        command: request.command,
        scope: request.text,
      });
      res.status(500).send('Failed to load bathroom leaderboard.');
    });
});
