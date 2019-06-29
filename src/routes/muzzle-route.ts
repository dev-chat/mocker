import express, { Request, Response, Router } from "express";
import {
  IEventRequest,
  ISlashCommandRequest
} from "../shared/models/slack/slack-models";
import {
  addUserToMuzzled,
  deleteMessage,
  muzzle,
  muzzled,
  sendMessage
} from "../utils/muzzle/muzzle-utils";
import { getUserId, getUserName } from "../utils/slack/slack-utils";

export const muzzleRoutes: Router = express.Router();
const MAX_SUPPRESSIONS: number = 7;

muzzleRoutes.post("/muzzle/handle", (req: Request, res: Response) => {
  const request: IEventRequest = req.body;
  console.log(request);
  if (muzzled.has(request.event.user)) {
    console.log(`${request.event.user} is muzzled! Suppressing his voice...`);
    deleteMessage(request.event.channel, request.event.ts);

    if (muzzled.get(request.event.user)!.suppressionCount < MAX_SUPPRESSIONS) {
      muzzled.set(request.event.user, {
        suppressionCount: ++muzzled.get(request.event.user)!.suppressionCount,
        muzzledBy: muzzled.get(request.event.user)!.muzzledBy
      });
      sendMessage(
        request.event.channel,
        `<@${request.event.user}> says "${muzzle(request.event.text)}"`
      );
    }
  } else if (
    request.event.subtype === "bot_message" &&
    request.event.attachments &&
    muzzled.has(getUserId(request.event.attachments[0].text)) &&
    request.event.username !== "muzzle"
  ) {
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
  const userName: string = getUserName(userId);
  const results = await addUserToMuzzled(
    userId,
    userName,
    request.user_id
  ).catch(e => res.send(e));
  if (results) {
    res.send(results);
  }
});
