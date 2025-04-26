import { NextFunction, Request, Response } from 'express';

export const textMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const { text } = req.body;
  if (!text || text.length > 800) {
    res.send(`Sorry, your request must be defined and cannot be more than 800 characters. Please refine your query.'`);
  } else {
    next();
  }
};
