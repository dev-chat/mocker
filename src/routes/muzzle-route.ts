import express, { Request, Response, Router } from "express";
import {
  IEventRequest,
  ISlashCommandRequest
} from "../shared/models/slack/slack-models";
import {
  ABUSE_PENALTY_TIME,
  addMuzzleTime,
  addUserToMuzzled,
  containsTag,
  deleteMessage,
  getTimeString,
  isUserMuzzled,
  sendMessage,
  sendMuzzledMessage,
  shouldBotMessageBeMuzzled
} from "../utils/muzzle/muzzle-utils";
import { getUserId, getUserName } from "../utils/slack/slack-utils";

export const muzzleRoutes: Router = express.Router();

muzzleRoutes.post("/muzzle/handle", (req: Request, res: Response) => {
  const request: IEventRequest = req.body;
  if (isUserMuzzled(request.event.user)) {
    console.log(
      `${getUserName(request.event.user)} | ${
        request.event.user
      } is muzzled! Suppressing his voice...`
    );
    deleteMessage(request.event.channel, request.event.ts);
    sendMuzzledMessage(
      request.event.channel,
      request.event.user,
      request.event.text
    );
    if (containsTag(request.event.text)) {
      console.log(
        `${getUserName(
          request.event.user
        )} atttempted to tag someone. Muzzle increased by ${ABUSE_PENALTY_TIME}!`
      );
      addMuzzleTime(request.event.user);
      setTimeout(
        () =>
          sendMessage(
            request.event.channel,
            `:rotating_light: <@${
              request.event.user
            }> attempted to tag someone, or the channel while muzzled! Muzzle increased by ${getTimeString(
              ABUSE_PENALTY_TIME
            )} :rotating_light:`
          ),
        1000
      );
    }
  } else if (shouldBotMessageBeMuzzled(request)) {
    console.log(
      `A user is muzzled and tried to send a bot message! Suppressing...`
    );
    deleteMessage(request.event.channel, request.event.ts);
  }
  res.send({ challenge: request.challenge });
});

muzzleRoutes.post("/muzzle", async (req: Request, res: Response) => {
  const request: ISlashCommandRequest = req.body;
  const userId: any = getUserId(request.text);
  const results = await addUserToMuzzled(userId, request.user_id).catch(e =>
    res.send(e)
  );
  if (results) {
    res.send(results);
  }
});
