import 'reflect-metadata'; // Necessary for TypeORM entities.
import bodyParser from 'body-parser';
import crypto from 'crypto';
import express, { Application, Response, NextFunction } from 'express';
import { createConnection, getConnectionOptions } from 'typeorm';
import { SlackService } from './services/slack/slack.service';
import { controllers } from './controllers/index.controller';

const app: Application = express();
const PORT = process.env.PORT || 3000;

const signatureVerification = (req: any, res: Response, next: NextFunction) => {
  const body = req.rawBody;
  const timestamp = req.headers['x-slack-request-timestamp'];
  const slackSignature = req.headers['x-slack-signature'];
  const base = 'v0:' + timestamp + ':' + body;
  const hashed: string =
    'v0=' +
    crypto
      .createHmac('sha256', process.env.MUZZLE_BOT_SIGNING_SECRET as string)
      .update(base)
      .digest('hex');

  if (
    hashed === slackSignature ||
    req.body.token === process.env.CLAPPER_TOKEN ||
    req.body.token === process.env.MOCKER_TOKEN ||
    req.body.token === process.env.DEFINE_TOKEN ||
    req.body.token === process.env.BLIND_TOKEN ||
    req.hostname === 'localhost'
  ) {
    next();
  } else {
    console.error('Someone is hitting your service from outside of slack.');
    console.error(req.ip);
    console.error(req.ips);
    console.error(req.headers);
    console.error(req.body);
    console.error(req);
    res.send('Naughty, naughty...');
    return;
  }
};

app.use(
  bodyParser.urlencoded({
    extended: true,
    verify: function(req: any, _res, buf) {
      req.rawBody = buf;
    },
  }),
);
app.use(
  bodyParser.json({
    verify: function(req: any, _res, buf) {
      req.rawBody = buf;
    },
  }),
);
app.use(signatureVerification);
app.use(controllers);

const slackService = SlackService.getInstance();

const connectToDb = async (): Promise<void> => {
  try {
    const options = await getConnectionOptions();
    createConnection(options)
      .then(connection => {
        if (connection.isConnected) {
          slackService.getAllUsers();
          slackService.getAndSaveAllChannels();
          console.log(`Connected to MySQL DB: ${options.database}`);
        } else {
          throw Error('Unable to connect to database');
        }
      })
      .catch(e => console.error(e));
  } catch (e) {
    console.error(e);
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
  e ? console.error(e) : console.log('Listening on port 3000');
  checkForEnvVariables();
  connectToDb();
});
