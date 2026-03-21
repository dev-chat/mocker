import type { Router } from 'express';
import express from 'express';
import { logger } from '../shared/logger/logger';

export const summaryController: Router = express.Router();
const summaryLogger = logger.child({ module: 'SummaryController' });

summaryController.post('/daily', (_, res) => {
  summaryLogger.warn('Received request to /summary/daily endpoint, which is deprecated.');
  res.status(200).send('This is deprecated. Please use /prompt.');
});

summaryController.post('/', (_, res) => {
  summaryLogger.warn(`Received request to /summary endpoint, which is deprecated.`);
  res.status(200).send('This is deprecated. Please use /prompt.');
});
