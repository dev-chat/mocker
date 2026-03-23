import type { Router } from 'express';
import express from 'express';
import Axios from 'axios';
import { createSessionToken } from '../shared/utils/session-token';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';

export const authController: Router = express.Router();
const authLogger = logger.child({ module: 'AuthController' });

const ALLOWED_TEAM_DOMAIN = 'dabros2016';
const SLACK_AUTH_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const SLACK_IDENTITY_URL = 'https://slack.com/api/users.identity';

interface SlackTokenResponse {
  ok: boolean;
  authed_user?: {
    id: string;
    access_token: string;
  };
}

interface SlackIdentityResponse {
  ok: boolean;
  user?: {
    id: string;
    name: string;
  };
  team?: {
    domain: string;
    id: string;
  };
}

authController.get('/slack', (_req, res) => {
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = process.env.SLACK_REDIRECT_URI ?? 'http://localhost:3000/auth/slack/callback';

  if (!clientId) {
    res.status(500).send('Slack OAuth is not configured');
    return;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    user_scope: 'identity.basic',
    redirect_uri: redirectUri,
  });

  res.redirect(`${SLACK_AUTH_URL}?${params.toString()}`);
});

authController.get('/slack/callback', (req, res) => {
  const frontendUrl = process.env.SEARCH_FRONTEND_URL ?? 'http://localhost:5173';

  void (async () => {
    const { code, error } = req.query;

    if (error || typeof code !== 'string') {
      res.redirect(`${frontendUrl}?auth_error=access_denied`);
      return;
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_REDIRECT_URI ?? 'http://localhost:3000/auth/slack/callback';

    if (!clientId || !clientSecret) {
      res.status(500).send('Slack OAuth is not configured');
      return;
    }

    const tokenResponse = await Axios.post<SlackTokenResponse>(
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

    const identityResponse = await Axios.get<SlackIdentityResponse>(SLACK_IDENTITY_URL, {
      headers: { Authorization: `Bearer ${tokenResponse.data.authed_user.access_token}` },
    });

    const teamDomain = identityResponse.data.team?.domain;
    const userId = identityResponse.data.user?.id;
    if (!identityResponse.data.ok || teamDomain !== ALLOWED_TEAM_DOMAIN || !userId) {
      res.redirect(`${frontendUrl}?auth_error=unauthorized_workspace`);
      return;
    }

    const sessionToken = createSessionToken(userId, teamDomain);
    res.redirect(`${frontendUrl}?token=${sessionToken}`);
  })().catch((e: unknown) => {
    logError(authLogger, 'Slack OAuth callback failed', e, {});
    res.redirect(`${frontendUrl}?auth_error=server_error`);
  });
});
