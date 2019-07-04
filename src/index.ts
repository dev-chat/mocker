import bodyParser from "body-parser";
import express, { Application } from "express";
import "reflect-metadata";
import { createConnection } from "typeorm";
import { defineRoutes } from "./routes/define-route";
import { mockRoutes } from "./routes/mock-route";
import { muzzleRoutes } from "./routes/muzzle-route";
import { getAllUsers } from "./utils/slack/slack-utils";

const app: Application = express();
const PORT: number = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(mockRoutes);
app.use(muzzleRoutes);
app.use(defineRoutes);

createConnection()
  .then(connection => {
    if (connection) {
      getAllUsers();
      console.log("Connected to MySql");
    }
  })
  .catch(e => console.error(e));

app.listen(PORT, (e: Error) =>
  e ? console.error(e) : console.log("Listening on port 3000")
);
