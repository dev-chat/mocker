import express, { Request, Response, Router } from "express";
import { BackFirePersistenceService } from "../services/backfire/backfire.persistence.service";
import { BackfireService } from "../services/backfire/backfire.service";
import { CounterPersistenceService } from "../services/counter/counter.persistence.service";
import { CounterService } from "../services/counter/counter.service";
import { ABUSE_PENALTY_TIME } from "../services/muzzle/constants";
import { getTimeString } from "../services/muzzle/muzzle-utilities";
import { MuzzlePersistenceService } from "../services/muzzle/muzzle.persistence.service";
import { MuzzleService } from "../services/muzzle/muzzle.service";
import { ReportService } from "../services/report/report.service";
import { SlackService } from "../services/slack/slack.service";
import { WebService } from "../services/web/web.service";
import { ReportType } from "../shared/models/muzzle/muzzle-models";
import {
  IEventRequest,
  ISlashCommandRequest
} from "../shared/models/slack/slack-models";

export const muzzleController: Router = express.Router();

const muzzleService = new MuzzleService();
const backfireService = new BackfireService();
const slackService = SlackService.getInstance();
const webService = WebService.getInstance();
const muzzlePersistenceService = MuzzlePersistenceService.getInstance();
const backfirePersistenceService = BackFirePersistenceService.getInstance();
const counterPersistenceService = CounterPersistenceService.getInstance();
const counterService = new CounterService();
const reportService = new ReportService();

muzzleController.post("/muzzle/handle", (req: Request, res: Response) => {
  const request: IEventRequest = req.body;
  const isNewUserAdded = request.event.type === "team_join";
  console.log(request);
  console.time("respond-to-event");
  if (isNewUserAdded) {
    slackService.getAllUsers();
  }

  const isUserMuzzled = muzzlePersistenceService.isUserMuzzled(
    request.event.user
  );
  const isUserBackfired = backfirePersistenceService.isBackfire(
    request.event.user
  );
  const isUserCounterMuzzled = counterPersistenceService.isCounterMuzzled(
    request.event.user
  );
  const containsTag = slackService.containsTag(request.event.text);
  const userName = slackService.getUserName(request.event.user);

  if (isUserMuzzled) {
    if (!containsTag) {
      console.log(
        `${userName} | ${
          request.event.user
        } is muzzled! Suppressing his voice...`
      );
      muzzleService.sendMuzzledMessage(
        request.event.channel,
        request.event.user,
        request.event.text,
        request.event.ts
      );
    } else if (
      containsTag &&
      (!request.event.subtype || request.event.subtype === "channel_topic")
    ) {
      const muzzleId = muzzlePersistenceService.getMuzzleId(request.event.user);
      console.log(
        `${slackService.getUserName(
          request.event.user
        )} attempted to tag someone or change the channel topic. Muzzle increased by ${ABUSE_PENALTY_TIME}!`
      );
      muzzlePersistenceService.addMuzzleTime(
        request.event.user,
        ABUSE_PENALTY_TIME
      );
      webService.deleteMessage(request.event.channel, request.event.ts);
      muzzlePersistenceService.trackDeletedMessage(
        muzzleId,
        request.event.text
      );
      webService.sendMessage(
        request.event.channel,
        `:rotating_light: <@${
          request.event.user
        }> attempted to @ while muzzled or change the channel topic! Muzzle increased by ${getTimeString(
          ABUSE_PENALTY_TIME
        )} :rotating_light:`
      );
    } else if (muzzleService.shouldBotMessageBeMuzzled(request)) {
      console.log(
        `A user is muzzled and tried to send a bot message! Suppressing...`
      );
      webService.deleteMessage(request.event.channel, request.event.ts);
    }
  } else if (isUserBackfired) {
    if (!containsTag) {
      console.log(
        `${userName} | ${
          request.event.user
        } is backfired! Suppressing his voice...`
      );
      backfireService.sendBackfiredMessage(
        request.event.channel,
        request.event.user,
        request.event.text,
        request.event.ts
      );
    } else if (containsTag && !request.event.subtype) {
      const backfireId = backfireService.getBackfire(request.event.user)!.id;
      console.log(
        `${slackService.getUserName(
          request.event.user
        )} attempted to tag someone. Backfire increased by ${ABUSE_PENALTY_TIME}!`
      );
      backfireService.addBackfireTime(request.event.user, ABUSE_PENALTY_TIME);
      webService.deleteMessage(request.event.channel, request.event.ts);
      backfireService.trackDeletedMessage(backfireId, request.event.text);
      webService.sendMessage(
        request.event.channel,
        `:rotating_light: <@${
          request.event.user
        }> attempted to @ while muzzled! Muzzle increased by ${getTimeString(
          ABUSE_PENALTY_TIME
        )} :rotating_light:`
      );
    } else if (backfireService.shouldBotMessageBeMuzzled(request)) {
      console.log(
        `A user is muzzled and tried to send a bot message! Suppressing...`
      );
      webService.deleteMessage(request.event.channel, request.event.ts);
    }
  } else if (isUserCounterMuzzled) {
    if (!containsTag) {
      console.log(
        `${userName} | ${
          request.event.user
        } is counter-muzzled! Suppressing his voice...`
      );
      counterService.sendCounterMuzzledMessage(
        request.event.channel,
        request.event.user,
        request.event.text,
        request.event.ts
      );
    } else if (containsTag && !request.event.subtype) {
      console.log(
        `${slackService.getUserName(
          request.event.user
        )} attempted to tag someone. Counter Muzzle increased by ${ABUSE_PENALTY_TIME}!`
      );
      console.log(request.event);
      counterPersistenceService.addCounterMuzzleTime(
        request.event.user,
        ABUSE_PENALTY_TIME
      );
      webService.deleteMessage(request.event.channel, request.event.ts);
      webService.sendMessage(
        request.event.channel,
        `:rotating_light: <@${
          request.event.user
        }> attempted to @ while countered! Muzzle increased by ${getTimeString(
          ABUSE_PENALTY_TIME
        )} :rotating_light:`
      );
    } else if (counterService.shouldBotMessageBeMuzzled(request)) {
      console.log(
        `A user is muzzled and tried to send a bot message! Suppressing...`
      );
      webService.deleteMessage(request.event.channel, request.event.ts);
    }
  }
  console.timeEnd("respond-to-event");
  res.send({ challenge: request.challenge });
});

muzzleController.post("/muzzle", async (req: Request, res: Response) => {
  const request: ISlashCommandRequest = req.body;
  console.log(request);
  const userId: any = slackService.getUserId(request.text);
  const results = await muzzleService
    .addUserToMuzzled(userId, request.user_id, request.channel_name)
    .catch(e => {
      res.send(e);
    });
  if (results) {
    res.send(results);
  }
});

muzzleController.post("/muzzle/stats", async (req: Request, res: Response) => {
  const request: ISlashCommandRequest = req.body;
  const userId: string = request.user_id;
  console.log(request);
  if (muzzlePersistenceService.isUserMuzzled(userId)) {
    res.send(`Sorry! Can't do that while muzzled.`);
  } else if (request.text.split(" ").length > 1) {
    res.send(
      `Sorry! No support for multiple parameters at this time. Please choose one of: \`week\`, \`month\`, \`trailing30\`, \`year\`, \`all\``
    );
  } else if (
    request.text !== "" &&
    !reportService.isValidReportType(request.text)
  ) {
    res.send(
      `Sorry! You passed in \`${
        request.text
      }\` but we can only generate reports for the following values: \`week\`, \`month\`, \`trailing30\`, \`year\`, \`all\``
    );
  } else {
    const reportType: ReportType = reportService.getReportType(request.text);
    const report = await reportService.getMuzzleReport(reportType);
    webService.uploadFile(
      req.body.channel_id,
      report,
      reportService.getReportTitle(reportType)
    );
    res.status(200).send();
  }
});
