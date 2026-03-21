import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../logger/logger';

const midLogger = logger.child({ module: 'SignatureVerificationMiddleware' });
export const signatureVerificationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const signingSecret = process.env.MUZZLE_BOT_SIGNING_SECRET;
  if (!signingSecret) {
    midLogger.error('MUZZLE_BOT_SIGNING_SECRET is not set. Rejecting request.');
    res.status(500).send('Server misconfiguration: signing secret is not set.');
    return;
  }

  const body =
    'rawBody' in req && (Buffer.isBuffer(req.rawBody) || typeof req.rawBody === 'string')
      ? String(req.rawBody)
      : JSON.stringify(req.body ?? '');
  const timestamp = req.headers['x-slack-request-timestamp'];
  const slackSignature = req.headers['x-slack-signature'];
  const base = 'v0:' + timestamp + ':' + body;
  const hashed: string =
    'v0=' +
    crypto
      .createHmac('sha256', signingSecret)
      .update(base)
      .digest('hex');

  if (
    hashed === slackSignature ||
    req.body.token === process.env.CLAPPER_TOKEN ||
    req.body.token === process.env.MOCKER_TOKEN ||
    req.body.token === process.env.DEFINE_TOKEN ||
    req.body.token === process.env.BLIND_TOKEN ||
    req.headers.authorization === process.env.HOOK_TOKEN ||
    req.hostname === '127.0.0.1'
  ) {
    next();
  } else {
    midLogger.error('Someone is hitting your service from outside of slack.');
    midLogger.error('ip: ', req.ip);
    midLogger.error('ips: ', req.ips);
    midLogger.error('headers: ', req.headers);
    midLogger.error('body:', req.body);
    res
      .status(400)
      .send(
        'You are trying to use this service from outside of Slack.\nEither request an API Token from Uncle JR or use the Slack client as god intended.',
      );
    return;
  }
};
