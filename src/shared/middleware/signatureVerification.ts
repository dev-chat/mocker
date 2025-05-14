import { Request, Response, NextFunction } from 'express';
import { RequestWithRawBody } from '../models/express/RequestWithRawBody';
import crypto from 'crypto';
import { logger } from '../logger/logger';

const midLogger = logger.child({ module: 'SignatureVerificationMiddleware' });
export const signatureVerificationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const body = (req as RequestWithRawBody).rawBody;
  const timestamp = req.headers['x-slack-request-timestamp'];
  const slackSignature = req.headers['x-slack-signature'];
  const base = 'v0:' + timestamp + ':' + body;
  const hashed: string =
    'v0=' +
    crypto
      .createHmac('sha256', process.env.MUZZLE_BOT_SIGNING_SECRET as string)
      .update(base)
      .digest('hex');

  if (
    hashed === slackSignature ||
    req.body.token === process.env.CLAPPER_TOKEN ||
    req.body.token === process.env.MOCKER_TOKEN ||
    req.body.token === process.env.DEFINE_TOKEN ||
    req.body.token === process.env.BLIND_TOKEN ||
    req.hostname === '127.0.0.1'
  ) {
    next();
  } else {
    midLogger.error('Someone is hitting your service from outside of slack.');
    midLogger.error('ip: ', req.ip);
    midLogger.error('ips: ', req.ips);
    midLogger.error('headers: ', req.headers);
    midLogger.error('body:', req.body);
    res.send('Naughty, naughty...');
    return;
  }
};
