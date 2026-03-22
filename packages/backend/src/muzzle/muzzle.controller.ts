import type { Request, Response, Router } from 'express';
import express from 'express';

import { WebService } from '../shared/services/web/web.service';
import type { SlashCommandRequest } from '../shared/models/slack/slack-models';
import type { ReportType } from '../shared/models/report/report.model';
import { SlackService } from '../shared/services/slack/slack.service';
import { MuzzleReportService } from './muzzle.report.service';
import { MuzzleService } from './muzzle.service';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { textMiddleware } from '../shared/middleware/textMiddleware';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';

export const muzzleController: Router = express.Router();
muzzleController.use(suppressedMiddleware);
muzzleController.use(textMiddleware);

const muzzleService = new MuzzleService();
const slackService = new SlackService();
const webService = new WebService();
const reportService = new MuzzleReportService();
const muzzleLogger = logger.child({ module: 'MuzzleController' });

muzzleController.post('/', (req: Request, res: Response) => {
  const request: SlashCommandRequest = req.body;
  const userId = slackService.getUserId(request.text);
  if (userId && request.user_id === userId) {
    res.send('Sorry, you cannot muzzle yourself anymore. JP ruined it.');
  } else if (userId) {
    muzzleService
      .addUserToMuzzled(userId, request.user_id, request.team_id, request.channel_name)
      .then((results) => res.send(results))
      .catch((e: unknown) => {
        logError(muzzleLogger, 'Failed to add user to muzzle list', e, {
          muzzledUserId: userId,
          requestorId: request.user_id,
          teamId: request.team_id,
          channelName: request.channel_name,
        });
        res.status(500).send('An unexpected error occurred. Please try again later.');
      });
  } else {
    muzzleLogger.warn(`Invalid user specified: ${request.text}`);
    res.send('Sorry, you must specify a valid Slack user.');
  }
});

muzzleController.post('/stats', (req: Request, res: Response) => {
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
    reportService
      .getMuzzleReport(reportType, request.team_id)
      .then((report) => {
        void webService.uploadFile(
          req.body.channel_id,
          report,
          reportService.getReportTitle(reportType),
          request.user_id,
        );
        res.status(200).send();
      })
      .catch((e) => {
        logError(muzzleLogger, 'Failed to generate muzzle report', e, {
          reportType,
          userId: request.user_id,
          teamId: request.team_id,
          channelId: request.channel_id,
        });
        res.status(500).send();
      });
  }
});
