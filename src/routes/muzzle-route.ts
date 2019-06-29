import express, { Request, Response, Router } from "express";
import {
  IEventRequest,
  ISlashCommandRequest
} from "../shared/models/slack/slack-models";
import {
  addUserToMuzzled,
  deleteMessage,
  isUserMuzzled,
  sendMuzzledMessage,
  shouldBotMessageBeMuzzled
} from "../utils/muzzle/muzzle-utils";
import { getUserId } from "../utils/slack/slack-utils";

export const muzzleRoutes: Router = express.Router();

muzzleRoutes.post("/muzzle/handle", (req: Request, res: Response) => {
  const request: IEventRequest = req.body;
  if (isUserMuzzled(request.event.user)) {
    console.log(`${request.event.user} is muzzled! Suppressing his voice...`);
    deleteMessage(request.event.channel, request.event.ts);
    sendMuzzledMessage(
      request.event.channel,
      request.event.user,
      request.event.text
    );
  } else if (shouldBotMessageBeMuzzled(request)) {
    console.log(
      `${
        request.authed_users[0]
      } is muzzled and tried to send a bot message! Suppressing...`
    );
    deleteMessage(request.event.channel, request.event.ts);
  }
  res.send({ challenge: request.challenge });
});

muzzleRoutes.post("/muzzle", async (req: Request, res: Response) => {
  const request: ISlashCommandRequest = req.body;
  const userId: string = getUserId(request.text);
  const results = await addUserToMuzzled(userId, request.user_id).catch(e =>
    res.send(e)
  );
  if (results) {
    res.send(results);
  }
});
