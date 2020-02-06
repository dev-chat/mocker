import express, { Router } from "express";
import { BackFirePersistenceService } from "../services/backfire/backfire.persistence.service";
import { CounterPersistenceService } from "../services/counter/counter.persistence.service";
import { MuzzlePersistenceService } from "../services/muzzle/muzzle.persistence.service";
import { ReactionService } from "../services/reaction/reaction.service";
import { ISlashCommandRequest } from "../shared/models/slack/slack-models";

export const reactionController: Router = express.Router();

const muzzlePersistenceService = MuzzlePersistenceService.getInstance();
const backfirePersistenceService = BackFirePersistenceService.getInstance();
const counterPersistenceService = CounterPersistenceService.getInstance();
const reactionService = new ReactionService();

reactionController.post("/rep/get", async (req, res) => {
  const request: ISlashCommandRequest = req.body;
  if (
    muzzlePersistenceService.isUserMuzzled(request.user_id) ||
    backfirePersistenceService.isBackfire(request.user_id) ||
    counterPersistenceService.isCounterMuzzled(request.user_id)
  ) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else {
    const repValue = await reactionService.getRep(request.user_id);
    res.send(repValue);
  }
});

reactionController.post("/rep/get/byUser", async (req, res) => {
  const request: ISlashCommandRequest = req.body;
  if (
    muzzlePersistenceService.isUserMuzzled(request.user_id) ||
    backfirePersistenceService.isBackfire(request.user_id) ||
    counterPersistenceService.isCounterMuzzled(request.user_id)
  ) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else {
    const repValue = await reactionService.getRepByUser(request.user_id);
    res.send(repValue);
  }
});
