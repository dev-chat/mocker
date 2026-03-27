import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from './authMiddleware';
import { createSessionToken } from '../utils/session-token';

type AuthReq = Parameters<typeof authMiddleware>[0];
type AuthRes = Parameters<typeof authMiddleware>[1];

const makeReq = (authorization?: string): AuthReq => ({ headers: { authorization } }) as AuthReq;

const makeRes = (): AuthRes => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as AuthRes;
  return res;
};

describe('authMiddleware', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, SEARCH_AUTH_SECRET: 'test-secret' };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('calls next for a valid Bearer token', () => {
    const token = createSessionToken('U1', 'dabros2016', 'T1');
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    authMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect((req as Request & { authSession?: { teamId?: string } }).authSession?.teamId).toBe('T1');
  });

  it('returns 401 when verified token payload has no teamId', () => {
    const token = createSessionToken('U1', 'dabros2016');
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    authMiddleware(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when Authorization header is missing', () => {
    const req = makeReq(undefined);
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    authMiddleware(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when Authorization header does not start with Bearer', () => {
    const req = makeReq('Basic sometoken');
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    authMiddleware(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for an invalid token', () => {
    const req = makeReq('Bearer invalid.token');
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    authMiddleware(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when token verification throws (e.g. SEARCH_AUTH_SECRET not set)', () => {
    const origNodeEnv = process.env.NODE_ENV;
    delete process.env.SEARCH_AUTH_SECRET;
    process.env.NODE_ENV = 'production';
    try {
      const req = makeReq('Bearer sometoken.withsig');
      const res = makeRes();
      const next = jest.fn() as unknown as NextFunction;

      authMiddleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    } finally {
      process.env.SEARCH_AUTH_SECRET = 'test-secret';
      process.env.NODE_ENV = origNodeEnv ?? '';
    }
  });
});
