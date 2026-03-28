import crypto from 'crypto';
import type { Request, Router } from 'express';
import express from 'express';
import Axios from 'axios';
import type { OauthV2AccessResponse, UsersIdentityResponse } from '@slack/web-api';
import { createSessionToken } from '../shared/utils/session-token';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';
import {
  ALLOWED_TEAM_DOMAIN,
  SLACK_AUTH_URL,
  SLACK_TOKEN_URL,
  SLACK_IDENTITY_URL,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_MS,
} from './auth.const';

export const authController: Router = express.Router();
const authLogger = logger.child({ module: 'AuthController' });

function getCookieValue(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(';').find((c) => c.trim().startsWith(`${name}=`));
  if (!match) return undefined;
  return match.split('=').slice(1).join('=');
}

authController.get('/slack', (_req, res) => {
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = process.env.SLACK_REDIRECT_URI;

  if (!clientId || !redirectUri) {
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
    user_scope: 'identity.basic',
    redirect_uri: redirectUri,
    state,
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

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      res.status(500).send('Slack OAuth is not configured');
      return;
    }

    const tokenResponse = await Axios.post<OauthV2AccessResponse>(
      SLACK_TOKEN_URL,
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    if (!tokenResponse.data.ok || !tokenResponse.data.authed_user) {
      res.redirect(`${frontendUrl}?auth_error=token_exchange_failed`);
      return;
    }

    const identityResponse = await Axios.get<UsersIdentityResponse>(SLACK_IDENTITY_URL, {
      headers: { Authorization: `Bearer ${tokenResponse.data.authed_user.access_token}` },
    });

    const teamDomain = identityResponse.data.team?.name;
    const teamId = identityResponse.data.team?.id;
    const userId = identityResponse.data.user?.id;
    if (!identityResponse.data.ok || teamDomain !== ALLOWED_TEAM_DOMAIN || !userId || !teamId) {
      logError(authLogger, 'Unauthorized Slack workspace attempted to authenticate', {
        teamDomain,
        teamId,
        userId,
      });
      res.redirect(`${frontendUrl}?auth_error=unauthorized_workspace`);
      return;
    }

    const sessionToken = createSessionToken(userId, teamDomain, teamId);
    res.redirect(`${frontendUrl}#token=${sessionToken}`);
  })().catch((e: unknown) => {
    logError(authLogger, 'Slack OAuth callback failed', e, {});
    res.redirect(`${frontendUrl}?auth_error=server_error`);
  });
});
