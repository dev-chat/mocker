import express, { Request, Response, Router } from "express";
import {
  capitalizeFirstLetter,
  define,
  formatDefs
} from "../services/define/define-utils";
import { IUrbanDictionaryResponse } from "../shared/models/define/define-models";
import {
  IChannelResponse,
  ISlashCommandRequest
} from "../shared/models/slack/slack-models";

import { MuzzleService } from "../services/muzzle/muzzle.service";
import { SlackService } from "../services/slack/slack.service";

export const defineController: Router = express.Router();
const muzzleService = MuzzleService.getInstance();
const slackService = SlackService.getInstance();

defineController.post("/define", async (req: Request, res: Response) => {
  const request: ISlashCommandRequest = req.body;

  if (muzzleService.isUserMuzzled(request.user_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else {
    try {
      const defined: IUrbanDictionaryResponse = await define(request.text);
      const response: IChannelResponse = {
        response_type: "in_channel",
        text: `*${capitalizeFirstLetter(request.text)}*`,
        attachments: formatDefs(defined.list)
      };
      slackService.sendResponse(request.response_url, response);
      res.status(200).send();
    } catch (e) {
      res.send(`error: ${e.message}`);
    }
  }
});
