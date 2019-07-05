import express, { Request, Response, Router } from "express";
import { IUrbanDictionaryResponse } from "../shared/models/define/define-models";
import {
  IChannelResponse,
  ISlashCommandRequest
} from "../shared/models/slack/slack-models";
import {
  capitalizeFirstLetter,
  define,
  formatDefs
} from "../utils/define/define-utils";
import { muzzled } from "../utils/muzzle/muzzle-utils";
import { sendResponse } from "../utils/slack/slack-utils";

export const defineRoutes: Router = express.Router();

defineRoutes.post("/define", async (req: Request, res: Response) => {
  const request: ISlashCommandRequest = req.body;

  if (muzzled.has(request.user_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else {
    try {
      const defined: IUrbanDictionaryResponse = await define(request.text);
      const response: IChannelResponse = {
        response_type: "in_channel",
        text: `*${capitalizeFirstLetter(request.text)}*`,
        attachments: formatDefs(defined.list)
      };
      sendResponse(request.response_url, response);
      res.status(200).send();
    } catch (e) {
      res.send(`error: ${e.message}`);
    }
  }
});
