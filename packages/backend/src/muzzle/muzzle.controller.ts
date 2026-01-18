import express, { Request, Response, Router } from 'express';

import { WebService } from '../shared/services/web/web.service';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { ReportType } from '../shared/models/report/report.model';
import { SlackService } from '../shared/services/slack/slack.service';
import { MuzzleReportService } from './muzzle.report.service';
import { MuzzleService } from './muzzle.service';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';
import { logger } from '../shared/logger/logger';

export const muzzleController: Router = express.Router();
muzzleController.use(suppressedMiddleware);
muzzleController.use(textMiddleware);

const muzzleService = new MuzzleService();
const slackService = new SlackService();
const webService = new WebService();
const reportService = new MuzzleReportService();
const muzzleLogger = logger.child({ module: 'MuzzleController' });

muzzleController.post('/', async (req: Request, res: Response) => {
  const request: SlashCommandRequest = req.body;
  const userId = slackService.getUserId(request.text);
  if (userId && request.user_id === userId) {
    res.send('Sorry, you cannot muzzle yourself anymore. JP ruined it.');
  } else if (userId) {
    const results = await muzzleService
      .addUserToMuzzled(userId, request.user_id, request.team_id, request.channel_name)
      .catch((e) => {
        muzzleLogger.error(e);
        res.send(e);
      });
    if (results) {
      res.send(results);
    }
  } else {
    muzzleLogger.warn(`Invalid user specified: ${request.text}`);
    res.send('Sorry, you must specify a valid Slack user.');
  }
});

muzzleController.post('/stats', async (req: Request, res: Response) => {
  const request: SlashCommandRequest = req.body;
  if (request.text.split(' ').length > 1) {
    muzzleLogger.warn(`Multiple parameters passed: ${request.text}`);
    res.send(
      `Sorry! No support for multiple parameters at this time. Please choose one of: \`trailing7\`, \`week\`, \`month\`, \`trailing30\`, \`year\`, \`all\``,
    );
  } else if (request.text !== '' && !reportService.isValidReportType(request.text)) {
    muzzleLogger.warn(`Invalid report type specified: ${request.text}`);
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
