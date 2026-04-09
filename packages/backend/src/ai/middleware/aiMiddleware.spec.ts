import { vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { aiMiddleware } from './aiMiddleware';
import { StoreService } from '../../store/store.service';
import { AIService } from '../ai.service';

vi.mock('openai');
vi.mock('../ai.persistence', async () => {
  return {
    AIPersistenceService: classMock(() => {
      return {
        removeInflight: vi.fn(),
        setInflight: vi.fn(),
        getInflight: vi.fn(),
        setDailyRequests: vi.fn(),
        decrementDailyRequests: vi.fn(),
        getDailyRequests: vi.fn(),
      };
    }),
  };
});

describe('aiMiddleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      body: {
        user_id: 'user123',
        team_id: 'team123',
      },
    };
    res = {
      send: vi.fn(),
    };
    next = vi.fn();
  });

  it('should not call next() if the user has reached max requests without a Moon Token', async () => {
    const isItemActiveSpy = vi.spyOn(StoreService.prototype, 'isItemActive').mockResolvedValue(false);
    const isAlreadyAtMaxRequestsSpy = vi.spyOn(AIService.prototype, 'isAlreadyAtMaxRequests').mockResolvedValue(true);
    const isAlreadyInFlightSpy = vi.spyOn(AIService.prototype, 'isAlreadyInflight').mockResolvedValue(false);

    aiMiddleware(req as Request, res as Response, next);
    await flushPromises();

    expect(isItemActiveSpy).toHaveBeenCalledWith('user123', 'team123', 4);
    expect(isAlreadyAtMaxRequestsSpy).toHaveBeenCalledWith('user123', 'team123');
    expect(isAlreadyInFlightSpy).toHaveBeenCalledWith('user123', 'team123');
    expect(res.send).toHaveBeenCalledWith(
      'Sorry, you have reached your maximum number of requests per day. Try again tomorrow or consider purchasing a Moon Token in the store.',
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should not call next() if the user has an in-flight request', async () => {
    vi.spyOn(StoreService.prototype, 'isItemActive').mockResolvedValue(false);
    vi.spyOn(AIService.prototype, 'isAlreadyAtMaxRequests').mockResolvedValue(false);
    const isAlreadyInFlightSpy = vi.spyOn(AIService.prototype, 'isAlreadyInflight').mockResolvedValue(true);

    aiMiddleware(req as Request, res as Response, next);
    await flushPromises();

    expect(isAlreadyInFlightSpy).toHaveBeenCalledWith('user123', 'team123');
    expect(res.send).toHaveBeenCalledWith(
      'Sorry, you already have a request in flight. Please wait for that request to complete.',
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should remove the Moon Token effect if the user has reached max requests but has a Moon Token, and then call next()', async () => {
    const isItemActiveSpy = vi.spyOn(StoreService.prototype, 'isItemActive').mockResolvedValue(true);
    const removeEffectSpy = vi.spyOn(StoreService.prototype, 'removeEffect').mockResolvedValue(1);
    vi.spyOn(AIService.prototype, 'isAlreadyAtMaxRequests').mockResolvedValue(true);
    vi.spyOn(AIService.prototype, 'isAlreadyInflight').mockResolvedValue(false);

    aiMiddleware(req as Request, res as Response, next);
    await flushPromises();

    expect(isItemActiveSpy).toHaveBeenCalledWith('user123', 'team123', 4);
    expect(removeEffectSpy).toHaveBeenCalledWith('user123', 'team123', 4);
    expect(next).toHaveBeenCalled();
  });

  it('should call next if the user has not reached max requests and has no in-flight requests', async () => {
    vi.spyOn(StoreService.prototype, 'isItemActive').mockResolvedValue(false);
    vi.spyOn(AIService.prototype, 'isAlreadyAtMaxRequests').mockResolvedValue(false);
    vi.spyOn(AIService.prototype, 'isAlreadyInflight').mockResolvedValue(false);

    aiMiddleware(req as Request, res as Response, next);
    await flushPromises();

    expect(next).toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });
});
