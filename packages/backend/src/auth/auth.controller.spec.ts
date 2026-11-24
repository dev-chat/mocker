import { vi } from 'vitest';
import { createHash } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import Axios from 'axios';

vi.mock('axios');
vi.mock('../shared/utils/session-token', async () => ({
  createSessionToken: vi.fn().mockReturnValue('mock-session-token'),
}));

import { authController } from './auth.controller';

const TEST_STATE = 'test-state-value';
const STATE_COOKIE = `oauth_state=${TEST_STATE}`;
const AH_VERIFIER = 'A'.repeat(43);
const AH_CHALLENGE = createHash('sha256').update(AH_VERIFIER).digest('base64url');

describe('authController', () => {
  const app = express();
  app.use(express.json());
  app.use('/', authController);

  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      SLACK_CLIENT_ID: 'test-client-id',
      SLACK_CLIENT_SECRET: 'test-client-secret',
      SLACK_REDIRECT_URI: 'http://localhost:3000/auth/slack/callback',
      SEARCH_FRONTEND_URL: 'http://localhost:5173',
      ALLOWED_TEAM_DOMAIN: 'T123',
    };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('GET /slack', () => {
    it('redirects to Slack OpenID Connect Sign in with Slack with identity-only scopes', async () => {
      const res = await request(app).get('/slack');
      const location = new URL(res.headers.location);

      expect(res.status).toBe(302);
      expect(location.origin + location.pathname).toBe('https://slack.com/openid/connect/authorize');
      expect(location.searchParams.get('client_id')).toBe('test-client-id');
      expect(location.searchParams.get('scope')).toBe('openid');
      expect(location.searchParams.get('response_type')).toBe('code');
      expect(location.searchParams.get('team')).toBe('T123');
      expect(location.searchParams.has('user_scope')).toBe(false);
      expect(location.searchParams.get('nonce')).toBe(location.searchParams.get('state'));
      expect(location.searchParams.get('state')).toBeTruthy();
      const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
      expect(cookies).toBeDefined();
      expect(cookies?.some((c: string) => c.startsWith('oauth_state='))).toBe(true);
    });

    it('returns 500 when SLACK_CLIENT_ID is not set', async () => {
      delete process.env.SLACK_CLIENT_ID;
      const res = await request(app).get('/slack');
      expect(res.status).toBe(500);
    });

    it('returns 500 when SLACK_REDIRECT_URI is not set', async () => {
      delete process.env.SLACK_REDIRECT_URI;
      const res = await request(app).get('/slack');
      expect(res.status).toBe(500);
    });

    it('returns 500 when ALLOWED_TEAM_DOMAIN is not set', async () => {
      delete process.env.ALLOWED_TEAM_DOMAIN;
      const res = await request(app).get('/slack');
      expect(res.status).toBe(500);
    });

    it('requires a well-formed challenge for AH login', async () => {
      expect((await request(app).get('/slack').query({ app: 'ah' })).status).toBe(400);
      expect((await request(app).get('/slack').query({ app: 'ah', challenge: 'invalid' })).status).toBe(400);
    });
  });

  describe('GET /slack/callback', () => {
    async function completeAhLogin(): Promise<string> {
      const start = await request(app).get('/slack').query({ app: 'ah', challenge: AH_CHALLENGE });
      const state = new URL(start.headers.location).searchParams.get('state');
      const cookies = (start.headers['set-cookie'] as unknown as string[]).map((cookie) => cookie.split(';')[0]);
      expect(cookies.some((cookie) => cookie === `oauth_ah_state=${state}.${AH_CHALLENGE}`)).toBe(true);
      (Axios.post as Mock).mockResolvedValue({ data: { ok: true, access_token: 'xoxp-token' } });
      (Axios.get as Mock).mockResolvedValue({
        data: { ok: true, 'https://slack.com/user_id': 'U123', 'https://slack.com/team_id': 'T123' },
      });
      const callback = await request(app)
        .get('/slack/callback')
        .set('Cookie', cookies)
        .query({ code: 'valid-code', state });
      expect(callback.status).toBe(302);
      const redirect = new URL(callback.headers.location);
      expect(redirect.origin).toBe('https://ah.muzzle.lol');
      expect(redirect.hash).not.toContain('token=');
      expect(
        (callback.headers['set-cookie'] as unknown as string[]).some((c) => c.startsWith('oauth_ah_state=;')),
      ).toBe(true);
      const code = new URLSearchParams(redirect.hash.slice(1)).get('code');
      expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
      return code!;
    }

    it('returns a one-use AH exchange code instead of a Muzzle bearer token', async () => {
      const code = await completeAhLogin();
      const result = await request(app).post('/ah/exchange').send({ code, verifier: AH_VERIFIER });
      expect(result.status).toBe(200);
      expect(result.headers['cache-control']).toBe('no-store');
      expect(result.body).toEqual({ userId: 'U123', teamId: 'T123', expiresAt: expect.any(Number) });
      expect((await request(app).post('/ah/exchange').send({ code, verifier: AH_VERIFIER })).status).toBe(401);
    });

    it('rejects a wrong verifier and consumes the exchange code', async () => {
      const code = await completeAhLogin();
      expect(
        (
          await request(app)
            .post('/ah/exchange')
            .send({ code, verifier: 'B'.repeat(43) })
        ).status,
      ).toBe(401);
      expect((await request(app).post('/ah/exchange').send({ code, verifier: AH_VERIFIER })).status).toBe(401);
    });

    it('rejects a missing or malformed verifier', async () => {
      const code = await completeAhLogin();
      expect((await request(app).post('/ah/exchange').send({ code })).status).toBe(400);
      expect((await request(app).post('/ah/exchange').send({ code, verifier: 'invalid' })).status).toBe(400);
    });

    it('rejects an expired AH exchange code', async () => {
      const code = await completeAhLogin();
      const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
      try {
        expect((await request(app).post('/ah/exchange').send({ code, verifier: AH_VERIFIER })).status).toBe(401);
      } finally {
        clock.mockRestore();
      }
    });

    it('does not send the AH code to an arbitrary destination', async () => {
      const start = await request(app).get('/slack').query({ app: 'https://evil.example' });
      const cookies = start.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((cookie) => cookie.startsWith('oauth_ah_state=;'))).toBe(true);
      expect(cookies.some((cookie) => /evil\.example/.test(cookie))).toBe(false);
    });

    it('does not issue an AH code when the OAuth state is incorrect', async () => {
      const res = await request(app)
        .get('/slack/callback')
        .set('Cookie', `${STATE_COOKIE}; oauth_ah_state=${TEST_STATE}.${AH_CHALLENGE}`)
        .query({ code: 'valid-code', state: 'wrong' });
      expect(res.headers.location).toBe('https://ah.muzzle.lol/?auth_error=access_denied');
      expect(Axios.post).not.toHaveBeenCalled();
    });

    it('returns 500 when SEARCH_FRONTEND_URL is not set', async () => {
      delete process.env.SEARCH_FRONTEND_URL;
      const res = await request(app)
        .get('/slack/callback')
        .set('Cookie', STATE_COOKIE)
        .query({ code: 'valid-code', state: TEST_STATE });
      expect(res.status).toBe(500);
    });

    it('redirects to frontend with token in hash on successful OAuth', async () => {
      (Axios.post as Mock).mockResolvedValue({
        data: { ok: true, access_token: 'xoxp-token' },
      });
      (Axios.get as Mock).mockResolvedValue({
        data: {
          ok: true,
          'https://slack.com/user_id': 'U123',
          'https://slack.com/team_id': 'T123',
        },
      });

      const res = await request(app)
        .get('/slack/callback')
        .set('Cookie', STATE_COOKIE)
        .query({ code: 'valid-code', state: TEST_STATE });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('#token=mock-session-token');
      expect(Axios.post).toHaveBeenCalledWith(
        'https://slack.com/api/openid.connect.token',
        expect.stringContaining('code=valid-code'),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      expect(Axios.get).toHaveBeenCalledWith('https://slack.com/api/openid.connect.userInfo', {
        headers: { Authorization: 'Bearer xoxp-token' },
      });
    });

    it('redirects with auth_error=access_denied when state cookie is missing', async () => {
      const res = await request(app).get('/slack/callback').query({ code: 'valid-code', state: TEST_STATE });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth_error=access_denied');
    });

    it('redirects with auth_error=access_denied when the state cookie is not present among other cookies', async () => {
      const res = await request(app)
        .get('/slack/callback')
        .set('Cookie', 'theme=dark')
        .query({ code: 'valid-code', state: TEST_STATE });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth_error=access_denied');
    });

    it('redirects with auth_error=access_denied when state does not match cookie', async () => {
      const res = await request(app)
        .get('/slack/callback')
        .set('Cookie', STATE_COOKIE)
        .query({ code: 'valid-code', state: 'wrong-state' });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth_error=access_denied');
    });

    it('redirects with auth_error=access_denied when state query param is missing', async () => {
      const res = await request(app).get('/slack/callback').set('Cookie', STATE_COOKIE).query({ code: 'valid-code' });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth_error=access_denied');
    });

    it('redirects with auth_error=access_denied when error param is present', async () => {
      const res = await request(app)
        .get('/slack/callback')
        .set('Cookie', STATE_COOKIE)
        .query({ error: 'access_denied', state: TEST_STATE });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth_error=access_denied');
    });

    it('redirects with auth_error=access_denied when code is missing', async () => {
      const res = await request(app).get('/slack/callback').set('Cookie', STATE_COOKIE).query({ state: TEST_STATE });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth_error=access_denied');
    });

    it('returns 500 when SLACK_CLIENT_SECRET is not set', async () => {
      delete process.env.SLACK_CLIENT_SECRET;
      const res = await request(app)
        .get('/slack/callback')
        .set('Cookie', STATE_COOKIE)
        .query({ code: 'some-code', state: TEST_STATE });
      expect(res.status).toBe(500);
    });

    it('returns 500 when SLACK_CLIENT_ID is not set', async () => {
      delete process.env.SLACK_CLIENT_ID;
      const res = await request(app)
        .get('/slack/callback')
        .set('Cookie', STATE_COOKIE)
        .query({ code: 'some-code', state: TEST_STATE });
      expect(res.status).toBe(500);
    });

    it('redirects with auth_error=token_exchange_failed when Slack token response is not ok', async () => {
      (Axios.post as Mock).mockResolvedValue({ data: { ok: false } });

      const res = await request(app)
        .get('/slack/callback')
        .set('Cookie', STATE_COOKIE)
        .query({ code: 'bad-code', state: TEST_STATE });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth_error=token_exchange_failed');
    });

    it('redirects with auth_error=token_exchange_failed when authed user access token is missing', async () => {
      (Axios.post as Mock).mockResolvedValue({ data: { ok: true } });

      const res = await request(app)
        .get('/slack/callback')
        .set('Cookie', STATE_COOKIE)
        .query({ code: 'bad-code', state: TEST_STATE });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth_error=token_exchange_failed');
    });

    it('redirects with auth_error=unauthorized_workspace when team id is wrong', async () => {
      (Axios.post as Mock).mockResolvedValue({
        data: { ok: true, access_token: 'xoxp-other' },
      });
      (Axios.get as Mock).mockResolvedValue({
        data: {
          ok: true,
          'https://slack.com/user_id': 'U999',
          'https://slack.com/team_id': 'T999',
        },
      });

      const res = await request(app)
        .get('/slack/callback')
        .set('Cookie', STATE_COOKIE)
        .query({ code: 'wrong-team-code', state: TEST_STATE });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth_error=unauthorized_workspace');
    });

    it('redirects with auth_error=unauthorized_workspace when identity response is not ok', async () => {
      (Axios.post as Mock).mockResolvedValue({
        data: { ok: true, access_token: 'xoxp-token' },
      });
      (Axios.get as Mock).mockResolvedValue({
        data: { ok: false },
      });

      const res = await request(app)
        .get('/slack/callback')
        .set('Cookie', STATE_COOKIE)
        .query({ code: 'bad-identity', state: TEST_STATE });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth_error=unauthorized_workspace');
    });

    it('redirects with auth_error=server_error when an unexpected exception is thrown', async () => {
      (Axios.post as Mock).mockRejectedValue(new Error('Network failure'));

      const res = await request(app)
        .get('/slack/callback')
        .set('Cookie', STATE_COOKIE)
        .query({ code: 'throw-code', state: TEST_STATE });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('auth_error=server_error');
    });
  });
});
