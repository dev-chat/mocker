import express, { Router } from "express";
import { ListPersistenceService } from "../services/list/list.persistence.service";
import { MuzzlePersistenceService } from "../services/muzzle/muzzle.persistence.service";
import { ReportService } from "../services/report/report.service";
import { SlackService } from "../services/slack/slack.service";
import { WebService } from "../services/web/web.service";
import {
  IChannelResponse,
  ISlashCommandRequest
} from "../shared/models/slack/slack-models";

export const listController: Router = express.Router();

const muzzlePersistenceService = MuzzlePersistenceService.getInstance();
const slackService = SlackService.getInstance();
const webService = WebService.getInstance();
const listPersistenceService = ListPersistenceService.getInstance();
const reportService = new ReportService();

listController.post("/list/retrieve", async (req, res) => {
  const request: ISlashCommandRequest = req.body;
  if (muzzlePersistenceService.isUserMuzzled(request.user_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else {
    const report = await reportService.getListReport();
    webService.uploadFile(req.body.channel_id, report, "The List");
    res.status(200).send();
  }
});

listController.post("/list/add", (req, res) => {
  const request: ISlashCommandRequest = req.body;
  if (muzzlePersistenceService.isUserMuzzled(request.user_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send("Sorry, you must send a message to list something.");
  } else if (request.text.length >= 255) {
    res.send("Sorry, items added to The List must be less than 255 characters");
  } else {
    listPersistenceService.store(request.user_id, request.text);
    const response: IChannelResponse = {
      response_type: "in_channel",
      text: `\`${request.text}\` has been \`listed\``
    };
    slackService.sendResponse(request.response_url, response);
    res.status(200).send();
  }
});

listController.post("/list/remove", (req, res) => {
  const request: ISlashCommandRequest = req.body;
  if (muzzlePersistenceService.isUserMuzzled(request.user_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send("Sorry, you must send the item you wish to remove.");
  } else {
    listPersistenceService
      .remove(request.text)
      .then(() => {
        const response: IChannelResponse = {
          response_type: "in_channel",
          text: `\`${request.text}\` has been removed from \`The List\``
        };
        slackService.sendResponse(request.response_url, response);
        res.status(200).send();
      })
      .catch(e => res.send(e));
  }
});
