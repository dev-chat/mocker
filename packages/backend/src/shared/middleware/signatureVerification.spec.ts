import crypto from 'crypto';
import { signatureVerificationMiddleware } from './signatureVerification';

type SignatureReq = Parameters<typeof signatureVerificationMiddleware>[0];
type SignatureRes = Parameters<typeof signatureVerificationMiddleware>[1];
type SignatureNext = Parameters<typeof signatureVerificationMiddleware>[2];

describe('signatureVerificationMiddleware', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.MUZZLE_BOT_SIGNING_SECRET = 'secret';
    process.env.CLAPPER_TOKEN = 'clap';
    process.env.MOCKER_TOKEN = 'mock';
    process.env.DEFINE_TOKEN = 'define';
    process.env.BLIND_TOKEN = 'blind';
    process.env.HOOK_TOKEN = 'hook';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('calls next when signature is valid', () => {
    const body = 'raw-body';
    const ts = '123';
    const sig =
      'v0=' +
      crypto
        .createHmac('sha256', 'secret')
        .update('v0:' + ts + ':' + body)
        .digest('hex');

    const req = {
      rawBody: body,
      headers: { 'x-slack-request-timestamp': ts, 'x-slack-signature': sig },
      body: {},
      hostname: 'example.com',
    } as SignatureReq;
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as SignatureRes;
    const next = jest.fn() as SignatureNext;

    signatureVerificationMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next when auth token matches', () => {
    const req = {
      rawBody: 'x',
      headers: { 'x-slack-request-timestamp': '1', 'x-slack-signature': 'bad', authorization: 'hook' },
      body: {},
      hostname: 'example.com',
    } as SignatureReq;
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as SignatureRes;
    const next = jest.fn() as SignatureNext;

    signatureVerificationMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects invalid external request', () => {
    const req = {
      rawBody: 'x',
      headers: { 'x-slack-request-timestamp': '1', 'x-slack-signature': 'bad' },
      body: {},
      hostname: 'example.com',
      ip: '1.2.3.4',
      ips: ['1.2.3.4'],
    } as SignatureReq;
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as SignatureRes;
    const next = jest.fn() as SignatureNext;

    signatureVerificationMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
