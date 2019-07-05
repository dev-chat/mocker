import express, { Request, Response, Router } from "express";
import { trackDeletedMessage } from "../db/Muzzle/actions/muzzle-actions";
import {
  IEventRequest,
  ISlashCommandRequest
} from "../shared/models/slack/slack-models";
import { getTimeString } from "../utils/muzzle/muzzle-utilities";
import { MuzzleManagerSingleton } from "../utils/muzzle/muzzle.service";
import {
  containsTag,
  getUserId,
  getUserName
} from "../utils/slack/slack.service";

export const muzzleRoutes: Router = express.Router();

muzzleRoutes.post("/muzzle/handle", (req: Request, res: Response) => {
  const request: IEventRequest = req.body;
  if (
    MuzzleManagerSingleton.isUserMuzzled(request.event.user) &&
    !containsTag(request.event.text)
  ) {
    console.log(
      `${getUserName(request.event.user)} | ${
        request.event.user
      } is muzzled! Suppressing his voice...`
    );
    MuzzleManagerSingleton.deleteMessage(
      request.event.channel,
      request.event.ts
    );
    MuzzleManagerSingleton.sendMuzzledMessage(
      request.event.channel,
      request.event.user,
      request.event.text
    );
  } else if (
    MuzzleManagerSingleton.isUserMuzzled(request.event.user) &&
    containsTag(request.event.text)
  ) {
    const muzzleId = MuzzleManagerSingleton.getMuzzleId(request.event.user);
    console.log(
      `${getUserName(
        request.event.user
      )} atttempted to tag someone. Muzzle increased by ${
        MuzzleManagerSingleton.ABUSE_PENALTY_TIME
      }!`
    );
    MuzzleManagerSingleton.addMuzzleTime(
      request.event.user,
      MuzzleManagerSingleton.ABUSE_PENALTY_TIME
    );
    MuzzleManagerSingleton.deleteMessage(
      request.event.channel,
      request.event.ts
    );
    trackDeletedMessage(muzzleId, request.event.text);
    MuzzleManagerSingleton.sendMessage(
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
    MuzzleManagerSingleton.deleteMessage(
      request.event.channel,
      request.event.ts
    );
  }
  res.send({ challenge: request.challenge });
});

muzzleRoutes.post("/muzzle", async (req: Request, res: Response) => {
  const request: ISlashCommandRequest = req.body;
  const userId: any = getUserId(request.text);
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
