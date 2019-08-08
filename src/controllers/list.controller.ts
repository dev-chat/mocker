import express, { Router } from "express";
import { ListPersistenceService } from "../services/list/list.persistence.service";
import { MuzzleService } from "../services/muzzle/muzzle.service";
import { SlackService } from "../services/slack/slack.service";
import {
  IChannelResponse,
  ISlashCommandRequest
} from "../shared/models/slack/slack-models";

export const listController: Router = express.Router();

const muzzleService = MuzzleService.getInstance();
const slackService = SlackService.getInstance();
const listPersistenceService = ListPersistenceService.getInstance();

listController.post("/list", (req, res) => {
  const request: ISlashCommandRequest = req.body;
  if (muzzleService.isUserMuzzled(request.user_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send("Sorry, you must send a message to list something.");
  } else {
    listPersistenceService.store(request.user_id, request.text);
    const response: IChannelResponse = {
      attachments: [
        {
          text: request.text
        }
      ],
      response_type: "in_channel",
      text: `<@${request.user_id}> listed:`
    };
    slackService.sendResponse(request.response_url, response);
    res.status(200).send();
  }
});
