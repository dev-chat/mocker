import express, { Router } from "express";
import {
  IChannelResponse,
  ISlashCommandRequest
} from "../shared/models/slack/slack-models";
import { mock } from "../utils/mock/mock-utils";
import { isUserMuzzled } from "../utils/muzzle/muzzle";
import { sendResponse } from "../utils/slack/slack-utils";

export const mockRoutes: Router = express.Router();

mockRoutes.post("/mock", (req, res) => {
  const request: ISlashCommandRequest = req.body;
  if (isUserMuzzled(request.user_id)) {
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
