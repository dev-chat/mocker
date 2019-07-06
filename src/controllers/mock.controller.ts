import express, { Router } from "express";
import { MockService } from "../services/mock/mock.service";
import { MuzzleService } from "../services/muzzle/muzzle.service";
import { SlackService } from "../services/slack/slack.service";
import {
  IChannelResponse,
  ISlashCommandRequest
} from "../shared/models/slack/slack-models";

export const mockController: Router = express.Router();

const muzzleService = MuzzleService.getInstance();
const slackService = SlackService.getInstance();
const mockService = MockService.getInstance();

mockController.post("/mock", (req, res) => {
  const request: ISlashCommandRequest = req.body;
  if (muzzleService.isUserMuzzled(request.user_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else {
    const mocked: string = mockService.mock(request.text);
    const response: IChannelResponse = {
      attachments: [
        {
          text: mocked
        }
      ],
      response_type: "in_channel",
      text: `<@${request.user_id}>`
    };
    slackService.sendResponse(request.response_url, response);
    res.status(200).send();
  }
});
