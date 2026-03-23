import crypto from 'crypto';
import { createSessionToken, verifySessionToken } from './session-token';

describe('session-token', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, SEARCH_AUTH_SECRET: 'test-secret' };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('createSessionToken', () => {
    it('returns a dot-separated base64url payload and signature', () => {
      const token = createSessionToken('U123', 'testworkspace');
      expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    });

    it('embeds userId and teamDomain in the payload', () => {
      const token = createSessionToken('U456', 'myteam');
      const [payload] = token.split('.');
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
      expect(decoded.userId).toBe('U456');
      expect(decoded.teamDomain).toBe('myteam');
    });

    it('sets an expiry timestamp in the future', () => {
      const before = Date.now();
      const token = createSessionToken('U1', 'team');
      const after = Date.now();
      const [payload] = token.split('.');
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
      expect(decoded.exp).toBeGreaterThan(before);
      expect(decoded.exp).toBeGreaterThan(after);
    });

    it('throws when SEARCH_AUTH_SECRET is not set in a non-test environment', () => {
      const origNodeEnv = process.env.NODE_ENV;
      delete process.env.SEARCH_AUTH_SECRET;
      process.env.NODE_ENV = 'production';
      try {
        expect(() => createSessionToken('U1', 'team')).toThrow();
      } finally {
        process.env.SEARCH_AUTH_SECRET = 'test-secret';
        process.env.NODE_ENV = origNodeEnv ?? '';
      }
    });
  });

  describe('verifySessionToken', () => {
    it('returns payload for a valid token', () => {
      const token = createSessionToken('U789', 'goodteam');
      const result = verifySessionToken(token);
      expect(result).not.toBeNull();
      expect(result?.userId).toBe('U789');
      expect(result?.teamDomain).toBe('goodteam');
    });

    it('returns null for a token with no dot separator', () => {
      expect(verifySessionToken('nodot')).toBeNull();
    });

    it('returns null when the token starts with a dot', () => {
      expect(verifySessionToken('.nopayload')).toBeNull();
    });

    it('returns null for a tampered signature', () => {
      const token = createSessionToken('U1', 'team');
      const tampered = token.slice(0, -4) + 'XXXX';
      expect(verifySessionToken(tampered)).toBeNull();
    });

    it('returns null for a malformed payload that is not valid base64url JSON', () => {
      const fakeSig = 'c2lnbmF0dXJl';
      expect(verifySessionToken(`notbase64url!!!!.${fakeSig}`)).toBeNull();
    });

    it('returns null for an expired token', () => {
      jest.useFakeTimers();
      const token = createSessionToken('U1', 'team');
      jest.advanceTimersByTime(25 * 60 * 60 * 1000); // 25 hours
      expect(verifySessionToken(token)).toBeNull();
      jest.useRealTimers();
    });

    it('returns null for a payload that is valid JSON but missing required fields', () => {
      const badPayload = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64url');
      const sig = crypto.createHmac('sha256', 'test-secret').update(badPayload).digest('base64url');
      expect(verifySessionToken(`${badPayload}.${sig}`)).toBeNull();
    });
  });
});
