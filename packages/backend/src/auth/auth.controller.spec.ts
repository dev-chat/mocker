import express from 'express';
import request from 'supertest';
import Axios from 'axios';

jest.mock('axios');
jest.mock('../shared/utils/session-token', () => ({
  createSessionToken: jest.fn().mockReturnValue('mock-session-token'),
}));

import { authController } from './auth.controller';

describe('authController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', authController);

  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      SLACK_CLIENT_ID: 'test-client-id',
      SLACK_CLIENT_SECRET: 'test-client-secret',
      SLACK_REDIRECT_URI: 'http://localhost:3000/auth/slack/callback',
      SEARCH_FRONTEND_URL: 'http://localhost:5173',
    };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('GET /slack', () => {
    it('redirects to Slack OAuth URL with client_id and user_scope', async () => {
      const res = await request(app).get('/slack');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('slack.com/oauth/v2/authorize');
      expect(res.headers.location).toContain('client_id=test-client-id');
      expect(res.headers.location).toContain('user_scope=identity.basic');
    });

    it('returns 500 when SLACK_CLIENT_ID is not set', async () => {
      delete process.env.SLACK_CLIENT_ID;
      const res = await request(app).get('/slack');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /slack/callback', () => {
    it('redirects to frontend with token on successful OAuth', async () => {
      (Axios.post as jest.Mock).mockResolvedValue({
        data: { ok: true, authed_user: { id: 'U123', access_token: 'xoxp-token' } },
      });
      (Axios.get as jest.Mock).mockResolvedValue({
        data: { ok: true, user: { id: 'U123', name: 'alice' }, team: { domain: 'dabros2016', id: 'T123' } },
      });

      const res = await request(app).get('/slack/callback').query({ code: 'valid-code' });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('token=mock-session-token');
    });

    it('redirects with auth_error=access_denied when error param is present', async () => {
      const res = await request(app).get('/slack/callback').query({ error: 'access_denied' });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth_error=access_denied');
    });

    it('redirects with auth_error=access_denied when code is missing', async () => {
      const res = await request(app).get('/slack/callback');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth_error=access_denied');
    });

    it('returns 500 when SLACK_CLIENT_SECRET is not set', async () => {
      delete process.env.SLACK_CLIENT_SECRET;
      const res = await request(app).get('/slack/callback').query({ code: 'some-code' });
      expect(res.status).toBe(500);
    });

    it('returns 500 when SLACK_CLIENT_ID is not set', async () => {
      delete process.env.SLACK_CLIENT_ID;
      const res = await request(app).get('/slack/callback').query({ code: 'some-code' });
      expect(res.status).toBe(500);
    });

    it('redirects with auth_error=token_exchange_failed when Slack token response is not ok', async () => {
      (Axios.post as jest.Mock).mockResolvedValue({ data: { ok: false } });

      const res = await request(app).get('/slack/callback').query({ code: 'bad-code' });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth_error=token_exchange_failed');
    });

    it('redirects with auth_error=token_exchange_failed when authed_user is missing', async () => {
      (Axios.post as jest.Mock).mockResolvedValue({ data: { ok: true } });

      const res = await request(app).get('/slack/callback').query({ code: 'bad-code' });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth_error=token_exchange_failed');
    });

    it('redirects with auth_error=unauthorized_workspace when team domain is wrong', async () => {
      (Axios.post as jest.Mock).mockResolvedValue({
        data: { ok: true, authed_user: { id: 'U999', access_token: 'xoxp-other' } },
      });
      (Axios.get as jest.Mock).mockResolvedValue({
        data: { ok: true, user: { id: 'U999', name: 'bob' }, team: { domain: 'otherworkspace', id: 'T999' } },
      });

      const res = await request(app).get('/slack/callback').query({ code: 'wrong-team-code' });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth_error=unauthorized_workspace');
    });

    it('redirects with auth_error=unauthorized_workspace when identity response is not ok', async () => {
      (Axios.post as jest.Mock).mockResolvedValue({
        data: { ok: true, authed_user: { id: 'U123', access_token: 'xoxp-token' } },
      });
      (Axios.get as jest.Mock).mockResolvedValue({
        data: { ok: false },
      });

      const res = await request(app).get('/slack/callback').query({ code: 'bad-identity' });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth_error=unauthorized_workspace');
    });

    it('redirects with auth_error=server_error when an unexpected exception is thrown', async () => {
      (Axios.post as jest.Mock).mockRejectedValue(new Error('Network failure'));

      const res = await request(app).get('/slack/callback').query({ code: 'throw-code' });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth_error=server_error');
    });
  });
});
