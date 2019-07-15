import express, { Request, Response, Router } from "express";
import { getTimeString } from "../services/muzzle/muzzle-utilities";
import { MuzzlePersistenceService } from "../services/muzzle/muzzle.persistence.service";
import { MuzzleService } from "../services/muzzle/muzzle.service";
import { SlackService } from "../services/slack/slack.service";
import { WebService } from "../services/web/web.service";
import {
  IChannelResponse,
  IEventRequest,
  ISlashCommandRequest
} from "../shared/models/slack/slack-models";

export const muzzleController: Router = express.Router();

const muzzleService = MuzzleService.getInstance();
const slackService = SlackService.getInstance();
const webService = WebService.getInstance();
const muzzlePersistenceService = MuzzlePersistenceService.getInstance();

muzzleController.post("/muzzle/handle", (req: Request, res: Response) => {
  const request: IEventRequest = req.body;
  if (
    muzzleService.isUserMuzzled(request.event.user) &&
    !slackService.containsTag(request.event.text)
  ) {
    console.log(
      `${slackService.getUserName(request.event.user)} | ${
        request.event.user
      } is muzzled! Suppressing his voice...`
    );
    webService.deleteMessage(request.event.channel, request.event.ts);
    muzzleService.sendMuzzledMessage(
      request.event.channel,
      request.event.user,
      request.event.text
    );
  } else if (
    muzzleService.isUserMuzzled(request.event.user) &&
    slackService.containsTag(request.event.text)
  ) {
    const muzzleId = muzzleService.getMuzzleId(request.event.user);
    console.log(
      `${slackService.getUserName(
        request.event.user
      )} atttempted to tag someone. Muzzle increased by ${
        muzzleService.ABUSE_PENALTY_TIME
      }!`
    );
    muzzleService.addMuzzleTime(
      request.event.user,
      muzzleService.ABUSE_PENALTY_TIME
    );
    webService.deleteMessage(request.event.channel, request.event.ts);
    muzzlePersistenceService.trackDeletedMessage(muzzleId, request.event.text);
    webService.sendMessage(
      request.event.channel,
      `:rotating_light: <@${
        request.event.user
      }> attempted to @ while muzzled! Muzzle increased by ${getTimeString(
        muzzleService.ABUSE_PENALTY_TIME
      )} :rotating_light:`
    );
  } else if (muzzleService.shouldBotMessageBeMuzzled(request)) {
    console.log(
      `A user is muzzled and tried to send a bot message! Suppressing...`
    );
    webService.deleteMessage(request.event.channel, request.event.ts);
  }
  res.send({ challenge: request.challenge });
});

muzzleController.post("/muzzle", async (req: Request, res: Response) => {
  const request: ISlashCommandRequest = req.body;
  const userId: any = slackService.getUserId(request.text);
  const results = await muzzleService
    .addUserToMuzzled(userId, request.user_id)
    .catch(e => {
      res.send(e);
    });
  if (results) {
    res.send(results);
  }
});

muzzleController.post("/muzzle/stats", async (req: Request, res: Response) => {
  const request: ISlashCommandRequest = req.body;
  const userId: any = slackService.getUserId(request.text);
  if (muzzleService.isUserMuzzled(userId)) {
    res.send(`Sorry! Can't do that while muzzled.`);
  }
  const report = await muzzlePersistenceService.retrieveWeeklyMuzzleReport();
  const response: IChannelResponse = {
    response_type: "in_channel",
    text: "*Muzzle Report*",
    attachments: muzzlePersistenceService.generateFormattedReport(report)
  };

  slackService.sendResponse(request.response_url, response);
  res.send("Report sent!");
});
