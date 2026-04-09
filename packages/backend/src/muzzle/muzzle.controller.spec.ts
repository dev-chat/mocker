import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const addUserToMuzzled = vi.fn();
const getUserId = vi.fn();
const isValidReportType = vi.fn();
const getReportType = vi.fn();
const getMuzzleReport = vi.fn();
const getReportTitle = vi.fn();
const uploadFile = vi.fn();

vi.mock('./muzzle.service', async () => ({
  MuzzleService: classMock(() => ({
    addUserToMuzzled,
  })),
}));

vi.mock('../shared/services/slack/slack.service', async () => ({
  SlackService: classMock(() => ({
    getUserId,
  })),
}));

vi.mock('./muzzle.report.service', async () => ({
  MuzzleReportService: classMock(() => ({
    isValidReportType,
    getReportType,
    getMuzzleReport,
    getReportTitle,
  })),
}));

vi.mock('../shared/services/web/web.service', async () => ({
  WebService: classMock(() => ({
    uploadFile,
  })),
}));

vi.mock('../shared/middleware/suppression', async () => ({
  suppressedMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../shared/middleware/textMiddleware', async () => ({
  textMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { muzzleController } from './muzzle.controller';

describe('muzzleController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', muzzleController);

  beforeEach(() => {
    vi.clearAllMocks();
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
