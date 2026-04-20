import 'reflect-metadata'; // Necessary for TypeORM entities.
import 'dotenv/config';
import bodyParser from 'body-parser';
import cors from 'cors';

import type { Application } from 'express';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { createConnection, getConnectionOptions } from 'typeorm';
import type { RequestWithRawBody } from './shared/models/express/RequestWithRawBody';
import { aiController } from './ai/ai.controller';
import { clapController } from './clap/clap.controller';
import { confessionController } from './confession/confession.controller';
import { counterController } from './counter/counter.controller';
import { defineController } from './define/define.controller';
import { eventController } from './event/event.controller';
import { healthController } from './health/health.controller';
import { listController } from './list/list.controller';
import { mockController } from './mock/mock.controller';
import { muzzleController } from './muzzle/muzzle.controller';
import { quoteController } from './quote/quote.controller';
import { reactionController } from './reaction/reaction.controller';
import { storeController } from './store/store.controller';
import { summaryController } from './summary/summary.controller';
import { walkieController } from './walkie/walkie.controller';
import { memoryController } from './memory/memory.controller';
import { SlackService } from './shared/services/slack/slack.service';
import { signatureVerificationMiddleware } from './shared/middleware/signatureVerification';
import { WebService } from './shared/services/web/web.service';
import { logger } from './shared/logger/logger';
import { AIService } from './ai/ai.service';
import { JobService } from './job.service';
import { resolveTypeOrmEntities } from './shared/db/typeorm-options';
import { portfolioController } from './portfolio/portfolio.controller';
import { hookController } from './hook/hook.controller';
import { searchController } from './search/search.controller';
import { authController } from './auth/auth.controller';
import { authMiddleware } from './shared/middleware/authMiddleware';
import { dashboardController } from './dashboard/dashboard.controller';
import { traitController } from './trait/trait.controller';

const app: Application = express();
const PORT = process.env.PORT || 3000;

const SEARCH_UI_ORIGIN = process.env.SEARCH_FRONTEND_URL;

if (!SEARCH_UI_ORIGIN) {
  logger.warn(
    'Environment variable SEARCH_FRONTEND_URL is not set; defaulting to disabling CORS for search/auth routes.',
  );
}

const searchCors = cors({
  origin: SEARCH_UI_ORIGIN || false,
});

app.use(
  bodyParser.urlencoded({
    extended: true,
    verify: function (req: RequestWithRawBody, _res, buf) {
      req.rawBody = buf;
    },
  }),
);
app.use(
  bodyParser.json({
    verify: function (req: RequestWithRawBody, _res, buf) {
      req.rawBody = buf;
    },
  }),
);
const AUTH_RATE_LIMIT_WINDOW_MS = 900000; // 15 minutes
const SEARCH_RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

const authRateLimit = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const searchRateLimit = rateLimit({
  windowMs: SEARCH_RATE_LIMIT_WINDOW_MS,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/auth', searchCors, authRateLimit, authController);
app.use('/search', searchCors, searchRateLimit, authMiddleware, searchController);
app.use('/dashboard', searchCors, searchRateLimit, authMiddleware, dashboardController);
app.use(signatureVerificationMiddleware);
app.use('/ai', aiController);
app.use('/clap', clapController);
app.use('/confess', confessionController);
app.use('/counter', counterController);
app.use('/define', defineController);
app.use('/event', eventController);
app.use('/health', healthController);
app.use('/hook', hookController);
app.use('/list', listController);
app.use('/memory', memoryController);
app.use('/mock', mockController);
app.use('/muzzle', muzzleController);
app.use('/portfolio', portfolioController);
app.use('/quote', quoteController);
app.use('/rep', reactionController);
app.use('/store', storeController);
app.use('/summary', summaryController);
app.use('/traits', traitController);
app.use('/walkie', walkieController);

const slackService = new SlackService();
const webService = new WebService();
const aiService = new AIService();
const jobService = new JobService(aiService);
const indexLogger = logger.child({ module: 'Index' });

const connectToDb = async (): Promise<boolean> => {
  try {
    const options = await getConnectionOptions();
    const overrideOptions = {
      ...options,
      charset: 'utf8mb4',
      entities: resolveTypeOrmEntities(),
      synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
    };
    return createConnection(overrideOptions)
      .then((connection) => {
        if (connection.isConnected) {
          void slackService.getAllUsers();
          slackService.getAndSaveAllChannels();
          indexLogger.info(`Connected to MySQL DB: ${options.database}`);
          return true;
        } else {
          throw Error('Unable to connect to database');
        }
      })
      .catch((e) => {
        indexLogger.error(e);
        return false;
      });
  } catch (e) {
    indexLogger.error(e);
    return false;
  }
};

const checkForEnvVariables = (): void => {
  if (!(process.env.MUZZLE_BOT_TOKEN && process.env.MUZZLE_BOT_USER_TOKEN)) {
    throw new Error('Missing MUZZLE_BOT_TOKEN or MUZZLE_BOT_USER_TOKEN environment variables.');
  } else if (
    !(
      process.env.TYPEORM_CONNECTION &&
      process.env.TYPEORM_HOST &&
      process.env.TYPEORM_USERNAME &&
      process.env.TYPEORM_PASSWORD &&
      process.env.TYPEORM_DATABASE &&
      process.env.TYPEORM_SYNCHRONIZE
    )
  ) {
    throw new Error('Missing TYPEORM environment variables!');
  } else if (
    !(
      process.env.MUZZLE_BOT_SIGNING_SECRET ||
      process.env.CLAPPER_TOKEN ||
      process.env.MOCKER_TOKEN ||
      process.env.DEFINE_TOKEN ||
      process.env.GOOGLE_TRANSLATE_API_KEY ||
      process.env.OPENAI_API_KEY
    )
  ) {
    throw new Error(
      'Missing MUZZLE_BOT_SIGNING_SECRET, CLAPPER_TOKEN, MOCKER_TOKEN, DEFINE_TOKEN, GOOGLE_TRANSLATE_API_KEY, or OPEN_API_KEY!',
    );
  }
};

app.listen(PORT, (e?: Error) => {
  if (e) {
    indexLogger.error(e);
  } else {
    indexLogger.info(`Listening on port ${PORT || 3000}`);
  }
  checkForEnvVariables();
  connectToDb()
    .then((connected) => {
      if (!connected) {
        indexLogger.error('Failed to connect to the database. Exiting application.');
        void webService.sendMessage(
          '#muzzlefeedback',
          ':siren-steves-a-moron: Failed to connect to the database. Moonbeam is not operational. :siren-steves-a-moron:',
        );
        process.exit(1);
      } else {
        indexLogger.info('Database connection established successfully.');
        void aiService.redeployMoonbeam();
        jobService.scheduleCronJobs();
      }
    })
    .catch((error) => {
      indexLogger.error('Error during database connection:', error);
      void webService.sendMessage(
        '#muzzlefeedback',
        ':siren-steves-a-moron: Failed to connect to the database. Moonbeam is not operational. :siren-steves-a-moron:',
      );
      process.exit(1);
    });
});
