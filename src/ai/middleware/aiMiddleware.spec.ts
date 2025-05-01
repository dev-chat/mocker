import { Request, Response, NextFunction } from 'express';
import { aiMiddleware } from './aiMiddleware';
import { StoreService } from '../../store/store.service';
import { AIService } from '../ai.service';

jest.mock('openai');

describe('aiMiddleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;


  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {
        user_id: 'user123',
        team_id: 'team123',
      },
    };
    res = {
      send: jest.fn(),
    };
    next = jest.fn();
  });

  it('should not call next() if the user has reached max requests without a Moon Token', async () => {
    const isItemActiveSpy = jest.spyOn(StoreService.prototype, 'isItemActive').mockResolvedValue(false);
    const isAlreadyAtMaxRequestsSpy = jest.spyOn(AIService.prototype, 'isAlreadyAtMaxRequests').mockResolvedValue(true);
    const isAlreadyInFlightSpy = jest.spyOn(AIService.prototype, 'isAlreadyInflight').mockResolvedValue(false);

    await aiMiddleware(req as Request, res as Response, next);

    expect(isItemActiveSpy).toHaveBeenCalledWith('user123', 'team123', 4);
    expect(isAlreadyAtMaxRequestsSpy).toHaveBeenCalledWith('user123', 'team123');
    expect(isAlreadyInFlightSpy).toHaveBeenCalledWith('user123', 'team123');
    expect(res.send).toHaveBeenCalledWith(
      'Sorry, you have reached your maximum number of requests per day. Try again tomorrow or consider purchasing a Moon Token in the store.',
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should not call next() if the user has an in-flight request', async () => {
    jest.spyOn(StoreService.prototype, 'isItemActive').mockResolvedValue(false);
    jest.spyOn(AIService.prototype, 'isAlreadyAtMaxRequests').mockResolvedValue(false);
    const isAlreadyInFlightSpy = jest.spyOn(AIService.prototype, 'isAlreadyInflight').mockResolvedValue(true);

    await aiMiddleware(req as Request, res as Response, next);

    expect(isAlreadyInFlightSpy).toHaveBeenCalledWith('user123', 'team123');
    expect(res.send).toHaveBeenCalledWith(
      'Sorry, you already have a request in flight. Please wait for that request to complete.',
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should remove the Moon Token effect if the user has reached max requests but has a Moon Token, and then call next()', async () => {
    const isItemActiveSpy = jest.spyOn(StoreService.prototype, 'isItemActive').mockResolvedValue(true);
    const removeEffectSpy = jest.spyOn(StoreService.prototype, 'removeEffect').mockResolvedValue(1);
    jest.spyOn(AIService.prototype, 'isAlreadyAtMaxRequests').mockResolvedValue(true);
    jest.spyOn(AIService.prototype, 'isAlreadyInflight').mockResolvedValue(false);

    await aiMiddleware(req as Request, res as Response, next);

    expect(isItemActiveSpy).toHaveBeenCalledWith('user123', 'team123', 4);
    expect(removeEffectSpy).toHaveBeenCalledWith('user123', 'team123', 4);
    expect(next).toHaveBeenCalled();
  });

  it('should call next if the user has not reached max requests and has no in-flight requests', async () => {
    jest.spyOn(StoreService.prototype, 'isItemActive').mockResolvedValue(false);
    jest.spyOn(AIService.prototype, 'isAlreadyAtMaxRequests').mockResolvedValue(false);
    jest.spyOn(AIService.prototype, 'isAlreadyInflight').mockResolvedValue(false);

    await aiMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });
});