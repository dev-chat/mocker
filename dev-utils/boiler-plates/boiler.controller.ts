import path from "path";

export const getBoilerPlateController = (serviceName: string) => {
  const relMuzzleService = path
    .relative(`src/controllers`, "src/services/muzzle/muzzle.service.ts")
    .slice(0, -3);
  const relSlackService = path
    .relative(`src/controllers`, "src/services/slack/slack.service.ts")
    .slice(0, -3);
  const relSlackModels = path
    .relative(`src/controllers`, "src/shared/models/slack/slack-models.ts")
    .slice(0, -3);
  const relMuzzPersist = path
    .relative(
      `src/controllers`,
      "src/services/muzzle/muzzle.persistence.service.ts"
    )
    .slice(0, -3);

  const boilerPlateController = `
  import express, { Router } from "express";
  import { MuzzlePersistenceService } from "${relMuzzPersist}";
  import { MuzzleService } from "${relMuzzleService}";
  import { SlackService } from "${relSlackService}";
  import {
    IChannelResponse,
    ISlashCommandRequest
  } from "${relSlackModels}";

  export const ${serviceName}Controller: Router = express.Router();

  const muzzleService = new MuzzleService();
  const slackService = SlackService.getInstance();

  ${serviceName}Controller.post("/${serviceName}", (req, res) => {
    const request: ISlashCommandRequest = req.body;
    if (muzzlePersistenceService.isUserMuzzled(request.user_id)) {
      res.send("Sorry, can't do that while muzzled.");
    } else if (!request.text) {
      res.send("Sorry, you must send a message to use this service.");
    } else {
      const response: IChannelResponse = {
        attachments: [
          {
            text: 'default'
          }
        ],
        response_type: "in_channel",
        text: 'A message sent by your service that should be replaced.'
      };
      slackService.sendResponse(request.response_url, response);
      res.status(200).send();
    }
  });`;

  return boilerPlateController;
};
