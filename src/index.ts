import bodyParser from "body-parser";
import express, { Application } from "express";
import "reflect-metadata";
import { createConnection } from "typeorm";
import { config } from "./ormconfig";
import { defineRoutes } from "./routes/define-route";
import { mockRoutes } from "./routes/mock-route";
import { muzzleRoutes } from "./routes/muzzle-route";
import { getAllUsers } from "./utils/slack/slack.service";

const app: Application = express();
const PORT: number = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(mockRoutes);
app.use(muzzleRoutes);
app.use(defineRoutes);

createConnection(config)
  .then(connection => {
    if (connection.isConnected) {
      getAllUsers();
      console.log(`Connected to MySQL DB: ${config.database}`);
    } else {
      throw Error("Unable to connect to database");
    }
  })
  .catch(e => console.error(e));

app.listen(PORT, (e: Error) =>
  e ? console.error(e) : console.log("Listening on port 3000")
);
