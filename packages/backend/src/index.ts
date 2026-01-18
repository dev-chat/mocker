import 'reflect-metadata'; // Necessary for TypeORM entities.
import 'dotenv/config';
import bodyParser from 'body-parser';

import express, { Application } from 'express';
import { createConnection, getConnectionOptions } from 'typeorm';
import { RequestWithRawBody } from './shared/models/express/RequestWithRawBody';
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
import { SlackService } from './shared/services/slack/slack.service';
import { signatureVerificationMiddleware } from './shared/middleware/signatureVerification';
import { WebService } from './shared/services/web/web.service';
import { logger } from './shared/logger/logger';
import { AIService } from './ai/ai.service';
import { portfolioController } from './portfolio/portfolio.controller';
import { hookController } from './hook/hook.controller';

const app: Application = express();
const PORT = process.env.PORT || 3000;

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
app.use('/mock', mockController);
app.use('/muzzle', muzzleController);
app.use('/portfolio', portfolioController);
app.use('/quote', quoteController);
app.use('/rep', reactionController);
app.use('/store', storeController);
app.use('/summary', summaryController);
app.use('/walkie', walkieController);

const slackService = new SlackService();
const webService = new WebService();
const aiService = new AIService();
const indexLogger = logger.child({ module: 'Index' });

const connectToDb = async (): Promise<boolean> => {
  try {
    const options = await getConnectionOptions();
    const overrideOptions = {
      ...options,
      charset: 'utf8mb4',
      synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
    };
    return createConnection(overrideOptions)
      .then((connection) => {
        if (connection.isConnected) {
          slackService.getAllUsers();
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
      process.env.TYPEORM_ENTITIES &&
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
  e ? indexLogger.error(e) : indexLogger.info(`Listening on port ${PORT || 3000}`);
  checkForEnvVariables();
  connectToDb()
    .then((connected) => {
      if (!connected) {
        indexLogger.error('Failed to connect to the database. Exiting application.');
        webService.sendMessage(
          '#muzzlefeedback',
          ':siren-steves-a-moron: Failed to connect to the database. Moonbeam is not operational. :siren-steves-a-moron:',
        );
        process.exit(1);
      } else {
        indexLogger.info('Database connection established successfully.');
        aiService.redeployMoonbeam();
      }
    })
    .catch((error) => {
      indexLogger.error('Error during database connection:', error);
      webService.sendMessage(
        '#muzzlefeedback',
        ':siren-steves-a-moron: Failed to connect to the database. Moonbeam is not operational. :siren-steves-a-moron:',
      );
      process.exit(1);
    });
});
