import express, { Router } from "express";
import { MuzzleService } from "../services/muzzle/muzzle.service";
import { SlackService } from "../services/slack/slack.service";
import { SpotifyService } from "../services/spotify/spotify.service";
import {
  IChannelResponse,
  ISlashCommandRequest
} from "../shared/models/slack/slack-models";

export const clapController: Router = express.Router();

const muzzleService = MuzzleService.getInstance();
const slackService = SlackService.getInstance();
const spotifyService = new SpotifyService();

clapController.post("/clap", (req, res) => {
  const request: ISlashCommandRequest = req.body;
  if (muzzleService.isUserMuzzled(request.user_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send("Sorry, you must send a message to clap.");
  } else if (request.text.split(" ").length === 1) {
    res.send("Sorry, you need more than one words to use clapper.");
  } else {
    const clapped: string = clapService.clap(request.text);
    const response: IChannelResponse = {
      attachments: [
        {
          text: clapped
        }
      ],
      response_type: "in_channel",
      text: `<@${request.user_id}>`
    };
    slackService.sendResponse(request.response_url, response);
    res.status(200).send();
  }
});
