import express, { Router } from "express";
import {
  IChannelResponse,
  ISlashCommandRequest
} from "../shared/models/slack/slack-models";
import { mock } from "../utils/mock/mock-utils";
import { MuzzleManagerSingleton } from "../utils/muzzle/muzzle.service";
import { sendResponse } from "../utils/slack/slack.service";

export const mockRoutes: Router = express.Router();

mockRoutes.post("/mock", (req, res) => {
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
    sendResponse(request.response_url, response);
    res.status(200).send();
  }
});
