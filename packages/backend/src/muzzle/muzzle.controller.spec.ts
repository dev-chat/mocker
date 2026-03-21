import express from 'express';
import request from 'supertest';

const addUserToMuzzled = jest.fn();
const getUserId = jest.fn();
const isValidReportType = jest.fn();
const getReportType = jest.fn();
const getMuzzleReport = jest.fn();
const getReportTitle = jest.fn();
const uploadFile = jest.fn();

jest.mock('./muzzle.service', () => ({
  MuzzleService: jest.fn().mockImplementation(() => ({
    addUserToMuzzled,
  })),
}));

jest.mock('../shared/services/slack/slack.service', () => ({
  SlackService: jest.fn().mockImplementation(() => ({
    getUserId,
  })),
}));

jest.mock('./muzzle.report.service', () => ({
  MuzzleReportService: jest.fn().mockImplementation(() => ({
    isValidReportType,
    getReportType,
    getMuzzleReport,
    getReportTitle,
  })),
}));

jest.mock('../shared/services/web/web.service', () => ({
  WebService: jest.fn().mockImplementation(() => ({
    uploadFile,
  })),
}));

jest.mock('../shared/middleware/suppression', () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: unknown) => next(),
}));

jest.mock('../shared/middleware/textMiddleware', () => ({
  textMiddleware: (_req: unknown, _res: unknown, next: unknown) => next(),
}));

import { muzzleController } from './muzzle.controller';

describe('muzzleController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', muzzleController);

  beforeEach(() => {
    jest.clearAllMocks();
    isValidReportType.mockReturnValue(true);
    getReportType.mockReturnValue('week');
    getMuzzleReport.mockResolvedValue('report');
    getReportTitle.mockReturnValue('title.txt');
    addUserToMuzzled.mockResolvedValue('ok');
  });

  it('rejects self-muzzle', async () => {
    getUserId.mockReturnValue('U1');
    const res = await request(app)
      .post('/')
      .send({ text: '<@U1>', user_id: 'U1', team_id: 'T1', channel_name: 'C1' })
      .expect(200);
    expect(res.text).toContain('cannot muzzle yourself');
  });

  it('handles invalid user text', async () => {
    getUserId.mockReturnValue(undefined);
    const res = await request(app)
      .post('/')
      .send({ text: 'bad', user_id: 'U1', team_id: 'T1', channel_name: 'C1' })
      .expect(200);
    expect(res.text).toContain('must specify a valid Slack user');
  });

  it('handles successful muzzle', async () => {
    getUserId.mockReturnValue('U2');
    const res = await request(app)
      .post('/')
      .send({ text: '<@U2>', user_id: 'U1', team_id: 'T1', channel_name: 'C1' })
      .expect(200);
    expect(res.text).toBe('ok');
    expect(addUserToMuzzled).toHaveBeenCalled();
  });

  it('returns report validation error on invalid stats type', async () => {
    isValidReportType.mockReturnValue(false);
    const res = await request(app)
      .post('/stats')
      .send({ text: 'badType', team_id: 'T1', user_id: 'U1', channel_id: 'C1' })
      .expect(200);
    expect(res.text).toContain('can only generate reports');
  });

  it('generates and uploads stats report', async () => {
    await request(app)
      .post('/stats')
      .send({ text: 'week', team_id: 'T1', user_id: 'U1', channel_id: 'C1' })
      .expect(200);

    expect(getMuzzleReport).toHaveBeenCalled();
    expect(uploadFile).toHaveBeenCalledWith('C1', 'report', 'title.txt', 'U1');
  });
});
