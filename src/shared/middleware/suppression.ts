import { NextFunction, Request, Response } from 'express';
import { SuppressorService } from '../services/suppressor.service';

export const suppressedMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const { user_id, team_id } = req.body;
  const suppressorService = new SuppressorService();
  const isSuppressed = await suppressorService.isSuppressed(user_id, team_id);
  if (isSuppressed) {
    res.send(`Sorry, can't do that while muzzled.`);
  } else {
    next();
  }
};
