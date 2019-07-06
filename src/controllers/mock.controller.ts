import express, { Router } from "express";
import { mock } from "../services/mock/mock-utils";
import { MuzzleManagerSingleton } from "../services/muzzle/muzzle.service";
import { SlackServiceSingleton } from "../services/slack/slack.service";
import {
  IChannelResponse,
  ISlashCommandRequest
} from "../shared/models/slack/slack-models";

export const mockController: Router = express.Router();

mockController.post("/mock", (req, res) => {
  const request: ISlashCommandRequest = req.body;
  if (MuzzleManagerSingleton.isUserMuzzled(request.user_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else {
    const mocked: string = mock(request.text);
    const response: IChannelResponse = {
      attachments: [
        {
          text: mocked
        }
      ],
      response_type: "in_channel",
      text: `<@${request.user_id}>`
    };
    SlackServiceSingleton.sendResponse(request.response_url, response);
    res.status(200).send();
  }
});
