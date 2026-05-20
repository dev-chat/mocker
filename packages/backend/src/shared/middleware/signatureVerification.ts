import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../logger/logger';

const midLogger = logger.child({ module: 'SignatureVerificationMiddleware' });
const SLACK_SIGNATURE_MAX_AGE_SECONDS = 60 * 5;

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
  const hashed: string = 'v0=' + crypto.createHmac('sha256', signingSecret).update(base).digest('hex');

  const isFreshSlackTimestamp: boolean = (() => {
    if (typeof timestamp !== 'string') {
      return false;
    }
    const timestampSeconds = Number(timestamp);
    if (!Number.isInteger(timestampSeconds)) {
      return false;
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    return Math.abs(nowSeconds - timestampSeconds) <= SLACK_SIGNATURE_MAX_AGE_SECONDS;
  })();

  const isValidSlackSignature: boolean = (() => {
    if (!isFreshSlackTimestamp) {
      return false;
    }
    if (typeof slackSignature !== 'string') {
      return false;
    }
    try {
      return crypto.timingSafeEqual(Buffer.from(hashed), Buffer.from(slackSignature));
    } catch {
      return false;
    }
  })();
  midLogger.info('Received request: ', { request: req });
  midLogger.info('Received request with body: ', { body });
  midLogger.info('Computed signature: ', { hashed });
  midLogger.info('Received signature: ', { slackSignature });
  midLogger.info('Is fresh Slack timestamp: ', { isFreshSlackTimestamp });
  midLogger.info('Is valid Slack signature: ', { isValidSlackSignature });

  if (isValidSlackSignature) {
    next();
  } else {
    if (!isFreshSlackTimestamp) {
      midLogger.warn('Rejecting request due to stale or invalid Slack timestamp.', {
        timestamp,
        nowSeconds: Math.floor(Date.now() / 1000),
        maxAgeSeconds: SLACK_SIGNATURE_MAX_AGE_SECONDS,
      });
    } else {
      midLogger.warn('Rejecting request due to Slack signature mismatch.', {
        timestamp,
      });
    }
    midLogger.error('Someone is hitting your service from outside of slack.');
    midLogger.error('ip: ', { ip: req.ip });
    midLogger.error('ips: ', { ips: req.ips });
    midLogger.error('headers: ', { headers: req.headers });
    midLogger.error('body:', { body: req.body });
    res
      .status(400)
      .send(
        'You are trying to use this service from outside of Slack.\nThis endpoint only accepts valid Slack signatures; use the Slack client as god intended.',
      );
    return;
  }
};
