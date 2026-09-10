import crypto from 'crypto';
import type { Request, Router } from 'express';
import express from 'express';
import Axios from 'axios';
import { createSessionToken } from '../shared/utils/session-token';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';
import {
  SLACK_AUTH_URL,
  SLACK_TOKEN_URL,
  SLACK_IDENTITY_URL,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_MS,
} from './auth.const';

export const authController: Router = express.Router();
const authLogger = logger.child({ module: 'AuthController' });

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

interface SignInAppConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

/**
 * Sign in with Slack must use a modern (granular scope) Slack app that only
 * requests OpenID Connect scopes. Pointing it at the classic bot app makes
 * Slack render the full app-installation consent screen, which regular
 * workspace members cannot approve.
 */
function getSignInAppConfig(): SignInAppConfig {
  return {
    clientId: process.env.SLACK_SIGNIN_CLIENT_ID ?? process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_SIGNIN_CLIENT_SECRET ?? process.env.SLACK_CLIENT_SECRET,
    redirectUri: process.env.SLACK_SIGNIN_REDIRECT_URI ?? process.env.SLACK_REDIRECT_URI,
  };
}

function getCookieValue(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(';').find((c) => c.trim().startsWith(`${name}=`));
  if (!match) return undefined;
  return match.split('=').slice(1).join('=');
}

authController.get('/slack', (_req, res) => {
  const { clientId, redirectUri } = getSignInAppConfig();
  const teamId = process.env.ALLOWED_TEAM_DOMAIN;

  if (!clientId || !redirectUri || !teamId) {
    res.status(500).send('Slack OAuth is not configured');
    return;
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: OAUTH_STATE_MAX_AGE_MS,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

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
  const frontendUrl = process.env.SEARCH_FRONTEND_URL;

  if (!frontendUrl) {
    res.status(500).send('Frontend URL is not configured');
    return;
  }

  void (async () => {
    const { code, error, state: stateFromQuery } = req.query;
    const stateFromCookie = getCookieValue(req, OAUTH_STATE_COOKIE);

    res.clearCookie(OAUTH_STATE_COOKIE);

    if (!stateFromCookie || typeof stateFromQuery !== 'string' || stateFromQuery !== stateFromCookie) {
      res.redirect(`${frontendUrl}?auth_error=access_denied`);
      return;
    }

    if (error || typeof code !== 'string') {
      res.redirect(`${frontendUrl}?auth_error=access_denied`);
      return;
    }

    const { clientId, clientSecret, redirectUri } = getSignInAppConfig();

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

    const teamId = identityResponse.data['https://slack.com/team_id'];
    const userId = identityResponse.data['https://slack.com/user_id'] ?? identityResponse.data.sub;
    if (!identityResponse.data.ok || !userId || !teamId || teamId !== process.env.ALLOWED_TEAM_DOMAIN) {
      logError(authLogger, 'Unauthorized Slack workspace attempted to authenticate', {
        teamId,
        userId,
      });
      res.redirect(`${frontendUrl}?auth_error=unauthorized_workspace`);
      return;
    }

    const sessionToken = createSessionToken(userId, teamId);
    res.redirect(`${frontendUrl}#token=${sessionToken}`);
  })().catch((e: unknown) => {
    logError(authLogger, 'Slack OAuth callback failed', e, {});
    res.redirect(`${frontendUrl}?auth_error=server_error`);
  });
});
