import express, { Router } from "express";
import { CounterService } from "../services/counter/counter.service";
import { MuzzlePersistenceService } from "../services/muzzle/muzzle.persistence.service";
import { ISlashCommandRequest } from "../shared/models/slack/slack-models";

export const counterController: Router = express.Router();

const muzzlePersistenceService = MuzzlePersistenceService.getInstance();
const counterService = new CounterService();

counterController.post("/counter", async (req, res) => {
  const request: ISlashCommandRequest = req.body;

  if (muzzlePersistenceService.isUserMuzzled(request.user_id)) {
    res.send("You can't counter someone if you are already muzzled!");
  } else if (!request.text) {
    res.send(
      "Sorry, you must specify who you would like to counter in order to use this service."
    );
  } else {
    const counterResult = await counterService
      .createCounter(request.text, request.user_id)
      .catch(e => res.send(e));

    if (counterResult) {
      res.send(counterResult);
    }
  }
});
