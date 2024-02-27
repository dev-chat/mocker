import express, { Request, Response, Router } from 'express';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { ReportType } from '../shared/models/report/report.model';
import { getService } from '../shared/services/service.injector';

export const muzzleController: Router = express.Router();

// TODO: This should have the logic from the addUserToMuzzled function in muzzleService.
muzzleController.post('/muzzle', async (req: Request, res: Response) => {
  const muzzleService = getService('MuzzleService');
  const slackService = getService('SlackService');
  const request: SlashCommandRequest = req.body;
  const userId = slackService.getUserId(request.text);
  if (userId && request.user_id === userId) {
    res.send('Sorry, you cannot muzzle yourself anymore. JP ruined it.');
  } else if (userId) {
    const results = await muzzleService
      .addUserToMuzzled(userId, request.user_id, request.team_id, request.channel_name)
      .catch((e) => {
        console.error(e);
        res.send(e);
      });
    if (results) {
      res.send(results);
    }
  } else {
    res.send('Sorry, you must specify a valid Slack user.');
  }
});

muzzleController.post('/muzzle/stats', async (req: Request, res: Response) => {
  const suppressorService = getService('SuppressorService');
  const reportService = getService('MuzzleReportService');
  const webService = getService('WebService');

  const request: SlashCommandRequest = req.body;
  if (await suppressorService.isSuppressed(request.user_id, request.team_id)) {
    res.send(`Sorry! Can't do that while muzzled.`);
  } else if (request.text.split(' ').length > 1) {
    res.send(
      `Sorry! No support for multiple parameters at this time. Please choose one of: \`trailing7\`, \`week\`, \`month\`, \`trailing30\`, \`year\`, \`all\``,
    );
  } else if (request.text !== '' && !reportService.isValidReportType(request.text)) {
    res.send(
      `Sorry! You passed in \`${request.text}\` but we can only generate reports for the following values: \`trailing7\`, \`week\`, \`month\`, \`trailing30\`, \`year\`, \`all\``,
    );
  } else {
    const reportType: ReportType = reportService.getReportType(request.text);
    const report = await reportService.getMuzzleReport(reportType, request.team_id);
    webService.uploadFile(req.body.channel_id, report, reportService.getReportTitle(reportType), request.user_id);
    res.status(200).send();
  }
});
