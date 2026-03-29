import type { Router } from 'express';
import express from 'express';
import { SearchPersistenceService } from './search.persistence.service';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';
import { MAX_LIMIT } from './search.const';
import type { RequestWithAuthSession } from '../shared/models/express/RequestWithAuthSession';

export const searchController: Router = express.Router();

const searchPersistenceService = new SearchPersistenceService();
const searchLogger = logger.child({ module: 'SearchController' });

const isPublicChannelId = (value: unknown): boolean => typeof value === 'string' && value.startsWith('C');

searchController.get('/filters', (req: RequestWithAuthSession, res) => {
  const teamId = req.authSession?.teamId;
  if (!teamId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  searchPersistenceService
    .getSearchFilters(teamId)
    .then((filters) => res.status(200).json(filters))
    .catch((e: unknown) => {
      logError(searchLogger, 'Failed to load search filters', e, { teamId });
      res.status(500).send();
    });
});

searchController.get('/messages', (req: RequestWithAuthSession, res) => {
  const teamId = req.authSession?.teamId;
  if (!teamId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { userName, channel, content, limit, offset } = req.query;

  if (!userName && !channel && !content) {
    res.status(400).json({ error: 'At least one search parameter (userName, channel, or content) is required' });
    return;
  }

  let parsedLimit: number | undefined;
  if (typeof limit === 'string') {
    const parsed = parseInt(limit, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      parsedLimit = Math.min(parsed, MAX_LIMIT);
    }
  }

  let parsedOffset: number | undefined;
  if (typeof offset === 'string') {
    const parsed = Number(offset);
    if (Number.isInteger(parsed) && parsed >= 0) {
      parsedOffset = parsed;
    }
  }

  searchPersistenceService
    .searchMessages({
      teamId,
      userName: typeof userName === 'string' ? userName : undefined,
      channel: typeof channel === 'string' ? channel : undefined,
      content: typeof content === 'string' ? content : undefined,
      limit: parsedLimit,
      offset: parsedOffset,
    })
    .then(({ messages, mentions, total }) =>
      res
        .status(200)
        .json({ messages: messages.filter((message) => isPublicChannelId(message.channel)), mentions, total }),
    )
    .catch((e: unknown) => {
      logError(searchLogger, 'Failed to search messages', e, {
        userName,
        channel,
        content,
      });
      res.status(500).send();
    });
});
