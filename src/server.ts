import bodyParser from "body-parser";
import express, { Application } from "express";
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

getAllUsers();

app.listen(PORT, (e: Error) =>
  e ? console.error(e) : console.log("Listening on port 3000")
);
