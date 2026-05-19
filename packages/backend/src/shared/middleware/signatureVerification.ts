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
  const hashed: string = 'v0=' + crypto.createHmac('sha256', signingSecret).update(base).digest('hex');

  const isValidSlackSignature: boolean = (() => {
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
  midLogger.info('Is valid Slack signature: ', { isValidSlackSignature });

  if (isValidSlackSignature) {
    next();
  } else {
    midLogger.error('Someone is hitting your service from outside of slack.');
    midLogger.error('ip: ', { ip: req.ip });
    midLogger.error('ips: ', { ips: req.ips });
    midLogger.error('headers: ', { headers: req.headers });
    midLogger.error('body:', { body: req.body });
    res
      .status(400)
      .send(
        'You are trying to use this service from outside of Slack.\nEither request an API Token from Uncle JR or use the Slack client as god intended.',
      );
    return;
  }
};
