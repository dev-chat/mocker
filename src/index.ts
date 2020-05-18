import bodyParser from 'body-parser';
import express, { Application } from 'express';
import { createConnection, getConnectionOptions } from 'typeorm';
import { SlackService } from './services/slack/slack.service';
import { controllers } from './controllers/index.controller';

const app: Application = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(controllers);

const slackService = SlackService.getInstance();

const connectToDb = async (): Promise<void> => {
  try {
    const options = await getConnectionOptions();
    createConnection(options)
      .then(connection => {
        if (connection.isConnected) {
          slackService.getAllUsers();
          slackService.getAllChannels();
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
  }
};

app.listen(PORT, (e?: Error) => {
  e ? console.error(e) : console.log('Listening on port 3000');
  checkForEnvVariables();
  connectToDb();
});
