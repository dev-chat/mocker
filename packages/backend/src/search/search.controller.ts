import type { Router } from 'express';
import express from 'express';
import { SearchPersistenceService } from './search.persistence.service';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';

export const searchController: Router = express.Router();

const searchPersistenceService = new SearchPersistenceService();
const searchLogger = logger.child({ module: 'SearchController' });

searchController.get('/messages', (req, res) => {
  const { userName, channel, content, limit } = req.query;

  searchPersistenceService
    .searchMessages({
      userName: typeof userName === 'string' ? userName : undefined,
      channel: typeof channel === 'string' ? channel : undefined,
      content: typeof content === 'string' ? content : undefined,
      limit: typeof limit === 'string' ? parseInt(limit, 10) : undefined,
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
