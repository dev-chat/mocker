import express, { Router } from 'express';
import { SlackService } from '../services/slack/slack.service';
import { WebService } from '../services/web/web.service';
import { ChannelResponse, SlashCommandRequest } from '../shared/models/slack/slack-models';
import { SuppressorService } from '../shared/services/suppressor.service';
import { DocsPersistenceService } from '../services/docs/docs.persistence.service';
import { DocsReportService } from '../services/docs/docs.report.service';

export const docsController: Router = express.Router();

const suppressorService = new SuppressorService();
const slackService = SlackService.getInstance();
const webService = WebService.getInstance();
const docsPersistenceService = DocsPersistenceService.getInstance();
const reportService = new DocsReportService();

docsController.post('/docs/retrieve', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else {
    const report = await reportService.getListReport();
    webService.uploadFile(req.body.channel_id, report, 'Docs', request.user_id);
    res.status(200).send();
  }
});

docsController.post('/docs/add', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send('Sorry, you must send a message to list something.');
  } else if (request.text.length >= 255) {
    res.send('Sorry, items added to The List must be less than 255 characters');
  } else {
    docsPersistenceService.store(request.user_id, request.text, request.team_id);
    const response: ChannelResponse = {
      // eslint-disable-next-line @typescript-eslint/camelcase
      response_type: 'in_channel',
      text: `\`${request.text}\` has been added to \`Docs\``,
    };
    slackService.sendResponse(request.response_url, response);
    res.status(200).send();
  }
});

docsController.post('/docs/remove', async (req, res) => {
  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else if (!request.text) {
    res.send('Sorry, you must send the item you wish to remove.');
  } else {
    docsPersistenceService
      .remove(request.text)
      .then(() => {
        const response: ChannelResponse = {
          // eslint-disable-next-line @typescript-eslint/camelcase
          response_type: 'in_channel',
          text: `\`${request.text}\` has been removed from \`Docs\``,
        };
        slackService.sendResponse(request.response_url, response);
        res.status(200).send();
      })
      .catch(e => res.send(e));
  }
});
