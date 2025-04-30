import { Request, Response, NextFunction } from "express";
import { RequestWithRawBody } from "../models/express/RequestWithRawBody";
import crypto from 'crypto';

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
    console.log('Signature verified successfully.', req.body);
    next();
  } else {
    console.error('Someone is hitting your service from outside of slack.');
    console.error(req.ip);
    console.error(req.ips);
    console.error(req.headers);
    console.error(req.body);
    res.send('Naughty, naughty...');
    return;
  }
};