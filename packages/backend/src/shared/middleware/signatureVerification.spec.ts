import { vi } from 'vitest';
import crypto from 'crypto';
import { signatureVerificationMiddleware } from './signatureVerification';

type SignatureReq = Parameters<typeof signatureVerificationMiddleware>[0];
type SignatureRes = Parameters<typeof signatureVerificationMiddleware>[1];
type SignatureNext = Parameters<typeof signatureVerificationMiddleware>[2];

const makeReq = (overrides: Record<string, unknown>): SignatureReq =>
  ({
    headers: {},
    body: {},
    hostname: 'example.com',
    ...overrides,
  }) as unknown as SignatureReq;

const makeRes = (): SignatureRes =>
  ({
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
  }) as unknown as SignatureRes;

const makeNext = (): SignatureNext => vi.fn() as SignatureNext;

const signBody = (
  body: string,
  timestamp = String(Math.floor(Date.now() / 1000)),
): { signature: string; timestamp: string } => ({
  timestamp,
  signature: 'v0=' + crypto.createHmac('sha256', 'secret').update(`v0:${timestamp}:${body}`).digest('hex'),
});

describe('signatureVerificationMiddleware', () => {
  const OLD_ENV = process.env;
  const FIXED_NOW = new Date('2026-01-01T00:00:00Z');

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    process.env = { ...OLD_ENV };
    process.env.MUZZLE_BOT_SIGNING_SECRET = 'secret';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('calls next when signature is valid', () => {
    const body = 'raw-body';
    const { signature, timestamp } = signBody(body);

    const req = makeReq({
      rawBody: body,
      headers: { 'x-slack-request-timestamp': timestamp, 'x-slack-signature': signature },
    });
    const res = makeRes();
    const next = makeNext();

    signatureVerificationMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next when signature is valid for a buffer rawBody', () => {
    const rawBody = Buffer.from('buffer-body');
    const { signature, timestamp } = signBody(String(rawBody));

    const req = makeReq({
      rawBody,
      headers: { 'x-slack-request-timestamp': timestamp, 'x-slack-signature': signature },
      body: { ignored: true },
    });
    const res = makeRes();
    const next = makeNext();

    signatureVerificationMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next when signature is valid using JSON stringified body fallback', () => {
    const body = { hello: 'world', count: 2 };
    const rawBody = JSON.stringify(body);
    const { signature, timestamp } = signBody(rawBody);

    const req = makeReq({
      headers: { 'x-slack-request-timestamp': timestamp, 'x-slack-signature': signature },
      body,
    });
    const res = makeRes();
    const next = makeNext();

    signatureVerificationMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects requests when the signing secret is missing', () => {
    delete process.env.MUZZLE_BOT_SIGNING_SECRET;

    const req = makeReq({
      rawBody: 'x',
      headers: { 'x-slack-request-timestamp': '1', 'x-slack-signature': 'bad' },
    });
    const res = makeRes();
    const next = makeNext();

    signatureVerificationMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Server misconfiguration: signing secret is not set.');
  });

  it('rejects requests when the signature header is missing', () => {
    const req = makeReq({
      rawBody: 'x',
      headers: { 'x-slack-request-timestamp': '1' },
      ip: '1.2.3.4',
      ips: ['1.2.3.4'],
    });
    const res = makeRes();
    const next = makeNext();

    signatureVerificationMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects requests when the signature header is not a string', () => {
    const req = makeReq({
      rawBody: 'x',
      headers: { 'x-slack-request-timestamp': '1', 'x-slack-signature': ['bad'] },
      ip: '1.2.3.4',
      ips: ['1.2.3.4'],
    });
    const res = makeRes();
    const next = makeNext();

    signatureVerificationMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects requests when the provided signature has a mismatched length', () => {
    const req = makeReq({
      rawBody: 'x',
      headers: { 'x-slack-request-timestamp': '1', 'x-slack-signature': 'short' },
      ip: '1.2.3.4',
      ips: ['1.2.3.4'],
    });
    const res = makeRes();
    const next = makeNext();

    signatureVerificationMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects invalid external request when the signature does not match', () => {
    const body = 'raw-body';
    const { timestamp } = signBody(body);

    const req = makeReq({
      rawBody: body,
      headers: {
        'x-slack-request-timestamp': timestamp,
        'x-slack-signature': signBody('other-body', timestamp).signature,
      },
      ip: '1.2.3.4',
      ips: ['1.2.3.4'],
    });
    const res = makeRes();
    const next = makeNext();

    signatureVerificationMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      'You are trying to use this service from outside of Slack.\nThis endpoint only accepts valid Slack signatures; use the Slack client as god intended.',
    );
  });

  it('rejects requests with stale timestamps even when signature matches', () => {
    const body = 'raw-body';
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 301);
    const { signature } = signBody(body, staleTimestamp);

    const req = makeReq({
      rawBody: body,
      headers: { 'x-slack-request-timestamp': staleTimestamp, 'x-slack-signature': signature },
      ip: '1.2.3.4',
      ips: ['1.2.3.4'],
    });
    const res = makeRes();
    const next = makeNext();

    signatureVerificationMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects requests with non-numeric timestamps', () => {
    const body = 'raw-body';
    const badTimestamp = 'not-a-number';
    const { signature } = signBody(body, badTimestamp);

    const req = makeReq({
      rawBody: body,
      headers: { 'x-slack-request-timestamp': badTimestamp, 'x-slack-signature': signature },
      ip: '1.2.3.4',
      ips: ['1.2.3.4'],
    });
    const res = makeRes();
    const next = makeNext();

    signatureVerificationMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
