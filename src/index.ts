import bodyParser from "body-parser";
import express, { Application } from "express";
import "reflect-metadata";
import { createConnection } from "typeorm";
import { defineController } from "./controllers/define.controller";
import { mockController } from "./controllers/mock.controller";
import { muzzleController } from "./controllers/muzzle.controller";
import { config } from "./ormconfig";
import { SlackService } from "./services/slack/slack.service";

const app: Application = express();
const PORT: number = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(mockController);
app.use(muzzleController);
app.use(defineController);

const slackService = SlackService.getInstance();

createConnection(config)
  .then(connection => {
    if (connection.isConnected) {
      slackService.getAllUsers();
      console.log(`Connected to MySQL DB: ${config.database}`);
    } else {
      throw Error("Unable to connect to database");
    }
  })
  .catch(e => console.error(e));

app.listen(PORT, (e: Error) =>
  e ? console.error(e) : console.log("Listening on port 3000")
);
