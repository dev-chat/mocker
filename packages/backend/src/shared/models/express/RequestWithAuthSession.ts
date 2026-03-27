import type { Request } from 'express';
import type { SessionPayload } from '../../utils/session-token.model';

export interface RequestWithAuthSession extends Request {
  authSession?: SessionPayload;
}
