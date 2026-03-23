import crypto from 'crypto';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSecret(): string {
  const secret = process.env.SEARCH_AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'test') {
      return 'insecure-test-secret';
    }
    throw new Error(
      'SEARCH_AUTH_SECRET environment variable is not set. ' +
        'Session tokens cannot be created or verified without a secret.',
    );
  }
  return secret;
}

export function createSessionToken(userId: string, teamDomain: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, teamDomain, exp: Date.now() + TOKEN_TTL_MS })).toString(
    'base64url',
  );
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export interface SessionPayload {
  userId: string;
  teamDomain: string;
  exp: number;
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return (
    typeof Reflect.get(value, 'userId') === 'string' &&
    typeof Reflect.get(value, 'teamDomain') === 'string' &&
    typeof Reflect.get(value, 'exp') === 'number'
  );
}

export function verifySessionToken(token: string): SessionPayload | null {
  const dotIndex = token.indexOf('.');
  if (dotIndex <= 0) return null;

  const payload = token.substring(0, dotIndex);
  const sig = token.substring(dotIndex + 1);
  if (!sig) return null;

  const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  } catch {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!isSessionPayload(parsed)) return null;
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
