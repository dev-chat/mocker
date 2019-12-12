import express, { Router } from "express";
import { MuzzlePersistenceService } from "../services/muzzle/muzzle.persistence.service";
import { WebService } from "../services/web/web.service";
import { ISlashCommandRequest } from "../shared/models/slack/slack-models";

export const confessionController: Router = express.Router();

const muzzlePersistenceService = MuzzlePersistenceService.getInstance();
const webService = WebService.getInstance();

confessionController.post("/confess", (req, res) => {
  const request: ISlashCommandRequest = req.body;
  if (muzzlePersistenceService.isUserMuzzled(request.user_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send("Sorry, you must send a message to confess.");
  } else {
    const confession: string = `Someone has confessed: 
    \`${request.text}\``;
    // Hardcodeded, maybe not the  best idea.
    webService.sendMessage("#confessions", confession);
    res.status(200).send();
  }
});
