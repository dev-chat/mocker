import express, { Request, Response, Router } from "express";
import { trackDeletedMessage } from "../db/Muzzle/actions/muzzle-actions";
import { getTimeString } from "../services/muzzle/muzzle-utilities";
import { MuzzleManagerSingleton } from "../services/muzzle/muzzle.service";
import { SlackServiceSingleton } from "../services/slack/slack.service";
import { WebClientSingleton } from "../services/WebClient/web-client.service";
import {
  IEventRequest,
  ISlashCommandRequest
} from "../shared/models/slack/slack-models";

export const muzzleController: Router = express.Router();

muzzleController.post("/muzzle/handle", (req: Request, res: Response) => {
  const request: IEventRequest = req.body;
  if (
    MuzzleManagerSingleton.isUserMuzzled(request.event.user) &&
    !SlackServiceSingleton.containsTag(request.event.text)
  ) {
    console.log(
      `${SlackServiceSingleton.getUserName(request.event.user)} | ${
        request.event.user
      } is muzzled! Suppressing his voice...`
    );
    WebClientSingleton.deleteMessage(request.event.channel, request.event.ts);
    MuzzleManagerSingleton.sendMuzzledMessage(
      request.event.channel,
      request.event.user,
      request.event.text
    );
  } else if (
    MuzzleManagerSingleton.isUserMuzzled(request.event.user) &&
    SlackServiceSingleton.containsTag(request.event.text)
  ) {
    const muzzleId = MuzzleManagerSingleton.getMuzzleId(request.event.user);
    console.log(
      `${SlackServiceSingleton.getUserName(
        request.event.user
      )} atttempted to tag someone. Muzzle increased by ${
        MuzzleManagerSingleton.ABUSE_PENALTY_TIME
      }!`
    );
    MuzzleManagerSingleton.addMuzzleTime(
      request.event.user,
      MuzzleManagerSingleton.ABUSE_PENALTY_TIME
    );
    WebClientSingleton.deleteMessage(request.event.channel, request.event.ts);
    trackDeletedMessage(muzzleId, request.event.text);
    WebClientSingleton.sendMessage(
      request.event.channel,
      `:rotating_light: <@${
        request.event.user
      }> attempted to @ while muzzled! Muzzle increased by ${getTimeString(
        MuzzleManagerSingleton.ABUSE_PENALTY_TIME
      )} :rotating_light:`
    );
  } else if (MuzzleManagerSingleton.shouldBotMessageBeMuzzled(request)) {
    console.log(
      `A user is muzzled and tried to send a bot message! Suppressing...`
    );
    WebClientSingleton.deleteMessage(request.event.channel, request.event.ts);
  }
  res.send({ challenge: request.challenge });
});

muzzleController.post("/muzzle", async (req: Request, res: Response) => {
  const request: ISlashCommandRequest = req.body;
  const userId: any = SlackServiceSingleton.getUserId(request.text);
  const results = await MuzzleManagerSingleton.addUserToMuzzled(
    userId,
    request.user_id
  ).catch(e => {
    res.send(e);
  });
  if (results) {
    res.send(results);
  }
});
