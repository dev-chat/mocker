import crypto from 'crypto';
import type { Request, Router } from 'express';
import express from 'express';
import Axios from 'axios';
import { createSessionToken } from '../shared/utils/session-token';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';
import { TOKEN_TTL_MS } from '../shared/utils/session-token.const';
import {
  SLACK_AUTH_URL,
  SLACK_TOKEN_URL,
  SLACK_IDENTITY_URL,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_MS,
} from './auth.const';

export const authController: Router = express.Router();
const authLogger = logger.child({ module: 'AuthController' });
const AH_FRONTEND_URL = 'https://ah.muzzle.lol/';
const AH_STATE_COOKIE = 'oauth_ah_state';
const AH_EXCHANGE_TTL_MS = 60_000;
const AH_MAX_EXCHANGES = 1_000;
const ahExchanges = new Map<
  string,
  { userId: string; teamId: string; expiresAt: number; codeExpiresAt: number; challenge: string }
>();

function createAhExchange(userId: string, teamId: string, challenge: string): string | null {
  const now = Date.now();
  for (const [code, exchange] of ahExchanges) {
    if (exchange.codeExpiresAt <= now) ahExchanges.delete(code);
  }
  if (ahExchanges.size >= AH_MAX_EXCHANGES) return null;
  const code = crypto.randomBytes(32).toString('base64url');
  ahExchanges.set(code, {
    userId,
    teamId,
    expiresAt: now + TOKEN_TTL_MS,
    codeExpiresAt: now + AH_EXCHANGE_TTL_MS,
    challenge,
  });
  return code;
}

// AH exchanges a short-lived one-time code server-to-server. It never receives
// a Muzzle bearer token or access to Muzzle's token-signing secret.
authController.post('/ah/exchange', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const code: unknown = req.body?.code;
  const verifier: unknown = req.body?.verifier;
  if (
    typeof code !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(code) ||
    typeof verifier !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(verifier)
  ) {
    res.status(400).json({ error: 'Invalid exchange code or verifier' });
    return;
  }
  const exchange = ahExchanges.get(code);
  ahExchanges.delete(code);
  const actualChallenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  if (
    !exchange ||
    exchange.codeExpiresAt <= Date.now() ||
    !crypto.timingSafeEqual(Buffer.from(actualChallenge), Buffer.from(exchange.challenge))
  ) {
    res.status(401).json({ error: 'Invalid or expired exchange code' });
    return;
  }
  res.json({ userId: exchange.userId, teamId: exchange.teamId, expiresAt: exchange.expiresAt });
});

interface SlackOpenIdTokenResponse {
  ok: boolean;
  access_token?: string;
}

interface SlackOpenIdUserInfoResponse {
  ok: boolean;
  sub?: string;
  'https://slack.com/user_id'?: string;
  'https://slack.com/team_id'?: string;
}

function getCookieValue(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(';').find((c) => c.trim().startsWith(`${name}=`));
  if (!match) return undefined;
  return match.split('=').slice(1).join('=');
}

authController.get('/slack', (req, res) => {
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = process.env.SLACK_REDIRECT_URI;
  const teamId = process.env.ALLOWED_TEAM_DOMAIN;

  if (!clientId || !redirectUri || !teamId) {
    res.status(500).send('Slack OAuth is not configured');
    return;
  }

  const challenge = req.query.challenge;
  if (req.query.app === 'ah' && (typeof challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(challenge))) {
    res.status(400).send('A valid AH login challenge is required');
    return;
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: OAUTH_STATE_MAX_AGE_MS,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  if (req.query.app === 'ah') {
    res.cookie(AH_STATE_COOKIE, `${state}.${challenge}`, {
      httpOnly: true,
      maxAge: OAUTH_STATE_MAX_AGE_MS,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  } else {
    res.clearCookie(AH_STATE_COOKIE);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    nonce: state,
    response_type: 'code',
    scope: 'openid',
    redirect_uri: redirectUri,
    state,
    team: teamId,
  });

  res.redirect(`${SLACK_AUTH_URL}?${params.toString()}`);
});

authController.get('/slack/callback', (req, res) => {
  const stateFromCookie = getCookieValue(req, OAUTH_STATE_COOKIE);
  const ahState = getCookieValue(req, AH_STATE_COOKIE);
  const ahParts = (ahState ?? '').split('.');
  const [ahCookieState, challenge] = ahParts;
  const isAh =
    !!stateFromCookie &&
    stateFromCookie === ahCookieState &&
    !!challenge &&
    /^[A-Za-z0-9_-]{43}$/.test(challenge) &&
    ahParts.length === 2;
  const frontendUrl = isAh ? AH_FRONTEND_URL : process.env.SEARCH_FRONTEND_URL;

  if (!frontendUrl) {
    res.status(500).send('Frontend URL is not configured');
    return;
  }

  void (async () => {
    const { code, error, state: stateFromQuery } = req.query;
    res.clearCookie(OAUTH_STATE_COOKIE);
    res.clearCookie(AH_STATE_COOKIE);

    if (!stateFromCookie || typeof stateFromQuery !== 'string' || stateFromQuery !== stateFromCookie) {
      res.redirect(`${frontendUrl}?auth_error=access_denied`);
      return;
    }

    if (error || typeof code !== 'string') {
      res.redirect(`${frontendUrl}?auth_error=access_denied`);
      return;
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      res.status(500).send('Slack OAuth is not configured');
      return;
    }

    const tokenResponse = await Axios.post<SlackOpenIdTokenResponse>(
      SLACK_TOKEN_URL,
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const accessToken = tokenResponse.data.access_token;
    if (!tokenResponse.data.ok || !accessToken) {
      res.redirect(`${frontendUrl}?auth_error=token_exchange_failed`);
      return;
    }

    const identityResponse = await Axios.get<SlackOpenIdUserInfoResponse>(SLACK_IDENTITY_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const allowedTeamId = process.env.ALLOWED_TEAM_DOMAIN;
    if (!allowedTeamId) {
      res.status(500).send('Slack OAuth is not configured');
      return;
    }

    const teamId = identityResponse.data['https://slack.com/team_id'];
    const userId = identityResponse.data['https://slack.com/user_id'] ?? identityResponse.data.sub;
    if (!identityResponse.data.ok || !userId || !teamId || teamId !== allowedTeamId) {
      logError(authLogger, 'Unauthorized Slack workspace attempted to authenticate', {
        teamId,
        userId,
      });
      res.redirect(`${frontendUrl}?auth_error=unauthorized_workspace`);
      return;
    }

    if (isAh) {
      const exchangeCode = createAhExchange(userId, teamId, challenge);
      if (!exchangeCode) {
        res.redirect(`${frontendUrl}?auth_error=server_busy`);
        return;
      }
      res.redirect(`${frontendUrl}#code=${exchangeCode}`);
      return;
    }
    const sessionToken = createSessionToken(userId, teamId);
    res.redirect(`${frontendUrl}#token=${sessionToken}`);
  })().catch((e: unknown) => {
    logError(authLogger, 'Slack OAuth callback failed', e, {});
    res.redirect(`${frontendUrl}?auth_error=server_error`);
  });
});
