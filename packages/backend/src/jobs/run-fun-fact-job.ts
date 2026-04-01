import 'reflect-metadata';
import 'dotenv/config';

import { createConnection, getConnectionOptions } from 'typeorm';
import { logger } from '../shared/logger/logger';
import { resolveTypeOrmEntities } from '../shared/db/typeorm-options';
import { FunFactJob } from './fun-fact.job';

const runLogger = logger.child({ module: 'RunFunFactJob' });

const validateRequiredEnv = (): void => {
  const requiredVars = [
    'MUZZLE_BOT_TOKEN',
    'MUZZLE_BOT_USER_TOKEN',
    'TYPEORM_CONNECTION',
    'TYPEORM_HOST',
    'TYPEORM_USERNAME',
    'TYPEORM_PASSWORD',
    'TYPEORM_DATABASE',
    'TYPEORM_SYNCHRONIZE',
  ];

  const missing = requiredVars.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

const run = async (): Promise<void> => {
  validateRequiredEnv();

  const options = await getConnectionOptions();
  const overrideOptions = {
    ...options,
    charset: 'utf8mb4',
    entities: resolveTypeOrmEntities(),
    synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
  };

  const connection = await createConnection(overrideOptions);

  try {
    runLogger.info('Connected to database, running fun-fact job');
    await new FunFactJob().run();
    runLogger.info('Fun-fact job runner completed');
  } finally {
    if (connection.isConnected) {
      await connection.close();
      runLogger.info('Database connection closed');
    }
  }
};

run().catch((error: unknown) => {
  runLogger.error('Fun-fact job runner failed', error);
  process.exit(1);
});
