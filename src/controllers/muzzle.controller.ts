import express, { Request, Response, Router } from 'express';
// import { MuzzleService } from '../services/muzzle/muzzle.service';
// import { SlackService } from '../services/slack/slack.service';
import { WebService } from '../services/web/web.service';
import { SlashCommandRequest } from '../shared/models/slack/slack-models';
import { ReportType } from '../shared/models/report/report.model';
import { SuppressorService } from '../shared/services/suppressor.service';
import { MuzzleReportService } from '../services/muzzle/muzzle.report.service';

export const muzzleController: Router = express.Router();

// const muzzleService = new MuzzleService();
// const slackService = SlackService.getInstance();
const webService = WebService.getInstance();
const suppressorService = new SuppressorService();
const reportService = new MuzzleReportService();

// TODO: This should have the logic from the addUserToMuzzled function in muzzleService.
muzzleController.post('/muzzle', async (_req: Request, res: Response) => {
  // Disables ability to muzzle.
  res.send('Muzzle is no longer enabled for your workspace.');
  // const request: SlashCommandRequest = req.body;
  // const userId: string = slackService.getUserId(request.text);
  // const results = await muzzleService
  //   .addUserToMuzzled(userId, request.user_id, request.team_id, request.channel_name)
  //   .catch(e => {
  //     console.error(e);
  //     res.send(e);
  //   });
  // if (results) {
  //   console.log(results);
  //   res.send(results);
  // }
});

muzzleController.post('/muzzle/stats', async (req: Request, res: Response) => {
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
