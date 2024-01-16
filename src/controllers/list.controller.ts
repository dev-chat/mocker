import express, { Router } from 'express';
import { ListPersistenceService } from '../services/list/list.persistence.service';
import { SlackService } from '../services/slack/slack.service';
import { WebService } from '../services/web/web.service';
import { ChannelResponse, SlashCommandRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';
import { ListReportService } from '../services/list/list.report.service';

export const listController: Router = express.Router();

const suppressorService = new SuppressorService();
const slackService = SlackService.getInstance();
const webService = WebService.getInstance();
const listPersistenceService = ListPersistenceService.getInstance();
const reportService = new ListReportService();

listController.post('/list/retrieve', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else {
    const report = await reportService.getListReport(request.channel_id, request.channel_name);
    webService.uploadFile(req.body.channel_id, report, `#${request.channel_name}'s List`, request.user_id);
    res.status(200).send();
  }
});

listController.post('/list/add', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send('Sorry, you must send a message to list something.');
  } else if (request.text.length >= 255) {
    res.send('Sorry, items added to The List must be less than 255 characters');
  } else {
    listPersistenceService.store(request.user_id, request.text, request.team_id, request.channel_id);
    const response: ChannelResponse = {
      response_type: 'in_channel',
      text: `\`${request.text}\` has been \`listed\``,
    };
    slackService.sendResponse(request.response_url, response);
    res.status(200).send();
  }
});

listController.post('/list/remove', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send('Sorry, you must send the item you wish to remove.');
  } else {
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
      .catch(e => res.send(e));
  }
});
