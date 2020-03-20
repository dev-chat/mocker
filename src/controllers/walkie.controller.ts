import express, { Router } from "express";
import { BackFirePersistenceService } from "../services/backfire/backfire.persistence.service";
import { CounterPersistenceService } from "../services/counter/counter.persistence.service";
import { MuzzlePersistenceService } from "../services/muzzle/muzzle.persistence.service";
import { SlackService } from "../services/slack/slack.service";
import { WalkieService } from "../services/walkie/walkie.service";
import {
  IChannelResponse,
  ISlashCommandRequest
} from "../shared/models/slack/slack-models";

export const walkieController: Router = express.Router();

const muzzlePersistenceService = MuzzlePersistenceService.getInstance();
const backfirePersistenceService = BackFirePersistenceService.getInstance();
const counterPersistenceService = CounterPersistenceService.getInstance();
const slackService = SlackService.getInstance();
const walkieService = new WalkieService();

walkieController.post("/walkie", (req, res) => {
  const request: ISlashCommandRequest = req.body;
  if (
    muzzlePersistenceService.isUserMuzzled(request.user_id) ||
    backfirePersistenceService.isBackfire(request.user_id) ||
    counterPersistenceService.isCounterMuzzled(request.user_id)
  ) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send("Sorry, you must send a message to walkie talk.");
  } else {
    const walkied: string = walkieService.walkieTalkie(request.text);
    const response: IChannelResponse = {
      response_type: "in_channel",
      text: `<@${request.user_id}>: ${walkied}`
    };
    slackService.sendResponse(request.response_url, response);
    res.status(200).send();
  }
});
