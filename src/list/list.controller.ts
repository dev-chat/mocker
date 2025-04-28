import express, { Router } from 'express';
import { ListPersistenceService } from './list.persistence.service';
import { WebService } from '../shared/services/web/web.service';
import { ChannelResponse, SlashCommandRequest } from '../shared/models/slack/slack-models';
import { ListReportService } from './list.report.service';
import { SlackService } from '../shared/services/slack/slack.service';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';

export const listController: Router = express.Router();
listController.use(suppressedMiddleware);
listController.use(textMiddleware);

const slackService = SlackService.getInstance();
const webService = WebService.getInstance();
const listPersistenceService = ListPersistenceService.getInstance();
const reportService = new ListReportService();

listController.post('/list/retrieve', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  const report = await reportService.getListReport(request.channel_id, request.channel_name);
  webService.uploadFile(req.body.channel_id, report, `#${request.channel_name}'s List`, request.user_id);
  res.status(200).send();
});

listController.post('/list/add', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  listPersistenceService.store(request.user_id, request.text, request.team_id, request.channel_id);
  const response: ChannelResponse = {
    response_type: 'in_channel',
    text: `\`${request.text}\` has been \`listed\``,
  };
  slackService.sendResponse(request.response_url, response);
  res.status(200).send();
});

listController.post('/list/remove', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  listPersistenceService
    .remove(request.text)
    .then(() => {
      const response: ChannelResponse = {
        response_type: 'in_channel',
        text: `\`${request.text}\` has been removed from \`The List\``,
      };
      slackService.sendResponse(request.response_url, response);
      res.status(200).send();
    })
    .catch((e) => res.send(e));
});
