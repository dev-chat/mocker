import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../shared/logger/logger';
import { SearchPersistenceService } from './search.persistence.service';

const authLogger = logger.child({ module: 'SearchAuthService' });

export interface SlackOAuthResponse {
  ok: boolean;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: {
    name: string;
    id: string;
  };
  authed_user?: {
    id: string;
    scope: string;
    access_token: string;
    token_type: string;
  };
  error?: string;
}

export interface SlackUserIdentity {
  ok: boolean;
  user?: {
    name: string;
    id: string;
    email?: string;
  };
  team?: {
    id: string;
    name?: string;
  };
  error?: string;
}

export interface JWTPayload {
  userId: string;
  teamId: string;
  userName: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  userId: string;
  teamId: string;
  userName: string;
  dbUserId?: number;
}

export class SearchAuthService {
  private persistenceService = new SearchPersistenceService();
  private jwtSecret: string;
  private allowedTeamId: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret-change-in-production';
    this.allowedTeamId = process.env.ALLOWED_TEAM_ID || '';

    if (!process.env.JWT_SECRET) {
      authLogger.warn('JWT_SECRET not set, using default. Set this in production!');
    }
  }

  async exchangeCodeForToken(code: string): Promise<SlackOAuthResponse> {
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = `${process.env.FRONTEND_URL}/auth/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Missing SLACK_CLIENT_ID or SLACK_CLIENT_SECRET environment variables');
    }

    try {
      const response = await axios.post<SlackOAuthResponse>(
        'https://slack.com/api/oauth.v2.access',
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: redirectUri,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data;
    } catch (error) {
      authLogger.error('Error exchanging code for token:', error);
      throw new Error('Failed to exchange authorization code');
    }
  }

  async getUserIdentity(accessToken: string): Promise<SlackUserIdentity> {
    try {
      const response = await axios.get<SlackUserIdentity>('https://slack.com/api/users.identity', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      authLogger.error('Error getting user identity:', error);
      throw new Error('Failed to get user identity from Slack');
    }
  }

  async authenticateWithSlack(code: string): Promise<{ token: string; user: AuthenticatedUser }> {
    const oauthResponse = await this.exchangeCodeForToken(code);

    if (!oauthResponse.ok || !oauthResponse.authed_user) {
      throw new Error(oauthResponse.error || 'OAuth failed');
    }

    const userAccessToken = oauthResponse.authed_user.access_token;
    const identity = await this.getUserIdentity(userAccessToken);

    if (!identity.ok || !identity.user || !identity.team) {
      throw new Error(identity.error || 'Failed to get user identity');
    }

    const teamId = identity.team.id;
    const userId = identity.user.id;
    const userName = identity.user.name;

    if (this.allowedTeamId && teamId !== this.allowedTeamId) {
      throw new Error('User is not part of the allowed workspace');
    }

    const dbUser = await this.persistenceService.getUserBySlackId(userId, teamId);

    const user: AuthenticatedUser = {
      userId,
      teamId,
      userName,
      dbUserId: dbUser?.id,
    };

    const token = this.createJWT(user);

    return { token, user };
  }

  createJWT(user: AuthenticatedUser): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.userId,
      teamId: user.teamId,
      userName: user.userName,
    };

    const header = { alg: 'HS256', typ: 'JWT' };
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 7 * 24 * 60 * 60;

    const fullPayload = { ...payload, iat, exp };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(fullPayload));

    const signature = this.toBase64Url(
      crypto.createHmac('sha256', this.jwtSecret).update(`${encodedHeader}.${encodedPayload}`).digest('base64'),
    );

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  verifyJWT(token: string): JWTPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const [encodedHeader, encodedPayload, signature] = parts;

      const expectedSignature = this.toBase64Url(
        crypto.createHmac('sha256', this.jwtSecret).update(`${encodedHeader}.${encodedPayload}`).digest('base64'),
      );

      if (signature !== expectedSignature) {
        return null;
      }

      const payload: JWTPayload = JSON.parse(this.base64UrlDecode(encodedPayload));

      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  private base64UrlEncode(str: string): string {
    return this.toBase64Url(Buffer.from(str).toString('base64'));
  }

  private base64UrlDecode(str: string): string {
    return Buffer.from(this.fromBase64Url(str), 'base64').toString('utf-8');
  }

  private toBase64Url(base64: string): string {
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private fromBase64Url(base64Url: string): string {
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return base64;
  }
}
