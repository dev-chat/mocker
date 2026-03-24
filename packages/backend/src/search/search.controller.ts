import type { Router } from 'express';
import express from 'express';
import { SearchPersistenceService } from './search.persistence.service';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';
import { MAX_LIMIT } from './search.const';

export const searchController: Router = express.Router();

const searchPersistenceService = new SearchPersistenceService();
const searchLogger = logger.child({ module: 'SearchController' });

searchController.get('/messages', (req, res) => {
  const { userName, channel, content, limit } = req.query;

  let parsedLimit: number | undefined;
  if (typeof limit === 'string') {
    const parsed = parseInt(limit, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      parsedLimit = Math.min(parsed, MAX_LIMIT);
    }
  }

  searchPersistenceService
    .searchMessages({
      userName: typeof userName === 'string' ? userName : undefined,
      channel: typeof channel === 'string' ? channel : undefined,
      content: typeof content === 'string' ? content : undefined,
      limit: parsedLimit,
    })
    .then((messages) => res.status(200).json(messages))
    .catch((e: unknown) => {
      logError(searchLogger, 'Failed to search messages', e, {
        userName,
        channel,
        content,
      });
      res.status(500).send();
    });
});
