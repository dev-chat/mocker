import { CounterService } from './counter.service';
import { ABUSE_PENALTY_TIME, MAX_SUPPRESSIONS } from '../muzzle/constants';
import type { EventRequest } from '../shared/models/slack/slack-models';

describe('CounterService', () => {
  let service: CounterService;
  const mockCounterPersistenceService = {
    getCounterByRequestorId: jest.fn(),
    addCounter: jest.fn(),
    getCounterMuzzle: jest.fn(),
    setCounterMuzzle: jest.fn(),
    removeCounter: jest.fn(),
    counterMuzzle: jest.fn(),
    isCounterMuzzled: jest.fn(),
    addCounterMuzzleTime: jest.fn(),
  };

  const mockMuzzlePersistenceService = {
    removeMuzzlePrivileges: jest.fn(),
  };

  const mockWebService = {
    sendMessage: jest.fn().mockResolvedValue({ ok: true }),
    deleteMessage: jest.fn(),
  };

  const mockSlackService = {
    containsTag: jest.fn(),
  };

  type CounterServicePrivate = CounterService & {
    counterPersistenceService: typeof mockCounterPersistenceService;
    muzzlePersistenceService: typeof mockMuzzlePersistenceService;
    webService: typeof mockWebService;
    slackService: typeof mockSlackService;
    sendSuppressedMessage: jest.Mock;
    sendCounterMuzzledMessage: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CounterService();

    // Override dependencies
    const privateService = service as unknown as CounterServicePrivate;
    privateService.counterPersistenceService = mockCounterPersistenceService;
    privateService.muzzlePersistenceService = mockMuzzlePersistenceService;
    privateService.webService = mockWebService;
    privateService.slackService = mockSlackService;
  });

  describe('createCounter()', () => {
    it('should create counter successfully', async () => {
      mockCounterPersistenceService.getCounterByRequestorId.mockReturnValue(undefined);
      mockCounterPersistenceService.addCounter.mockResolvedValue(void 0);

      const result = await service.createCounter('U123', 'T123');

      expect(result).toContain('Counter set for the next');
      expect(mockCounterPersistenceService.addCounter).toHaveBeenCalledWith('U123', 'T123');
    });

    it('should reject with invalid user', async () => {
      await expect(service.createCounter('', 'T123')).rejects.toThrow('Invalid user');
    });

    it('should reject if user already has counter', async () => {
      mockCounterPersistenceService.getCounterByRequestorId.mockReturnValue(123);

      await expect(service.createCounter('U123', 'T123')).rejects.toThrow('already have a counter');
    });

    it('should handle database errors', async () => {
      mockCounterPersistenceService.getCounterByRequestorId.mockReturnValue(undefined);
      mockCounterPersistenceService.addCounter.mockRejectedValue(new Error('DB Error'));

      await expect(service.createCounter('U123', 'T123')).rejects.toThrow('DB Error');
    });
  });

  describe('getCounterByRequestorId()', () => {
    it('should return counter ID if exists', () => {
      mockCounterPersistenceService.getCounterByRequestorId.mockReturnValue(456);

      const result = service.getCounterByRequestorId('U123');

      expect(result).toBe(456);
    });

    it('should return undefined if no counter exists', () => {
      mockCounterPersistenceService.getCounterByRequestorId.mockReturnValue(undefined);

      const result = service.getCounterByRequestorId('U123');

      expect(result).toBeUndefined();
    });
  });

  describe('sendCounterMuzzledMessage()', () => {
    it('should send suppressed message if counter exists and under max suppressions', async () => {
      const counterMuzzle = {
        counterId: '789',
        suppressionCount: 2,
        removalFn: () => {},
      };
      mockCounterPersistenceService.getCounterMuzzle.mockReturnValue(counterMuzzle);
      (service as unknown as CounterServicePrivate).sendSuppressedMessage = jest.fn();

      await service.sendCounterMuzzledMessage('C123', 'U123', 'Hello', '1234567890');

      expect(mockCounterPersistenceService.setCounterMuzzle).toHaveBeenCalledWith('U123', {
        counterId: '789',
        suppressionCount: 3, // incremented
        removalFn: expect.any(Function),
      });
      expect((service as unknown as CounterServicePrivate).sendSuppressedMessage).toHaveBeenCalled();
    });

    it('should not send message if counter does not exist', async () => {
      mockCounterPersistenceService.getCounterMuzzle.mockReturnValue(undefined);
      (service as unknown as CounterServicePrivate).sendSuppressedMessage = jest.fn();

      await service.sendCounterMuzzledMessage('C123', 'U123', 'Hello', '1234567890');

      expect(mockCounterPersistenceService.setCounterMuzzle).not.toHaveBeenCalled();
      expect((service as unknown as CounterServicePrivate).sendSuppressedMessage).not.toHaveBeenCalled();
    });

    it('should not send message if at max suppressions', async () => {
      const counterMuzzle = {
        counterId: '789',
        suppressionCount: MAX_SUPPRESSIONS,
        removalFn: () => {},
      };
      mockCounterPersistenceService.getCounterMuzzle.mockReturnValue(counterMuzzle);
      (service as unknown as CounterServicePrivate).sendSuppressedMessage = jest.fn();

      await service.sendCounterMuzzledMessage('C123', 'U123', 'Hello', '1234567890');

      expect(mockCounterPersistenceService.setCounterMuzzle).not.toHaveBeenCalled();
      expect((service as unknown as CounterServicePrivate).sendSuppressedMessage).not.toHaveBeenCalled();
    });
  });

  describe('removeCounter()', () => {
    it('should remove counter and send announcement if used', () => {
      service.removeCounter(789, true, 'U123', 'U456', 'C123', 'T123');

      expect(mockCounterPersistenceService.removeCounter).toHaveBeenCalledWith(789, true, 'C123', 'T123', 'U456');
      expect(mockCounterPersistenceService.counterMuzzle).toHaveBeenCalledWith('U456', 789);
      expect(mockMuzzlePersistenceService.removeMuzzlePrivileges).toHaveBeenCalledWith('U456', 'T123');
      expect(mockWebService.sendMessage).toHaveBeenCalledWith(
        'C123',
        expect.stringContaining('successfully countered'),
      );
    });

    it('should not send announcement if counter not used', () => {
      service.removeCounter(789, false, 'U123', 'U456', 'C123', 'T123');

      expect(mockCounterPersistenceService.removeCounter).toHaveBeenCalled();
      expect(mockCounterPersistenceService.counterMuzzle).not.toHaveBeenCalled();
      expect(mockWebService.sendMessage).not.toHaveBeenCalled();
    });

    it('should not send announcement if no channel', () => {
      service.removeCounter(789, true, 'U123', 'U456', '', 'T123');

      expect(mockCounterPersistenceService.removeCounter).toHaveBeenCalled();
      expect(mockCounterPersistenceService.counterMuzzle).not.toHaveBeenCalled();
      expect(mockWebService.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle sendMessage errors', async () => {
      mockWebService.sendMessage.mockRejectedValue(new Error('Send failed'));
      const loggerSpy = jest.spyOn(service.logger, 'error');

      service.removeCounter(789, true, 'U123', 'U456', 'C123', 'T123');

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('handle()', () => {
    it('should process regular message events', async () => {
      const event: Partial<EventRequest['event']> = {
        type: 'message',
        user: 'U123',
        text: 'Hello world',
        channel: 'C123',
        ts: '1234567890',
      };

      mockSlackService.containsTag.mockReturnValue(false);
      mockCounterPersistenceService.isCounterMuzzled.mockResolvedValue(false);
      (service as unknown as CounterServicePrivate).sendCounterMuzzledMessage = jest.fn();

      await service.handle({ event } as EventRequest);

      expect(mockSlackService.containsTag).toHaveBeenCalledWith('Hello world');
    });

    it('should process message.channels events', async () => {
      const event: Partial<EventRequest['event']> = {
        type: 'message.channels',
        user: 'U123',
        text: 'Hello world',
        channel: 'C123',
        ts: '1234567890',
      };

      mockSlackService.containsTag.mockReturnValue(false);
      mockCounterPersistenceService.isCounterMuzzled.mockResolvedValue(false);
      (service as unknown as CounterServicePrivate).sendCounterMuzzledMessage = jest.fn();

      await service.handle({ event } as EventRequest);

      expect(mockSlackService.containsTag).toHaveBeenCalled();
    });

    it('should send muzzled message for countered users without tags', async () => {
      const event: Partial<EventRequest['event']> = {
        type: 'message',
        user: 'U123',
        text: 'Hello world',
        channel: 'C123',
        ts: '1234567890',
      };

      mockSlackService.containsTag.mockReturnValue(false);
      mockCounterPersistenceService.isCounterMuzzled.mockResolvedValue(true);
      (service as unknown as CounterServicePrivate).sendCounterMuzzledMessage = jest.fn();

      await service.handle({ event } as EventRequest);

      expect((service as unknown as CounterServicePrivate).sendCounterMuzzledMessage).toHaveBeenCalledWith(
        'C123',
        'U123',
        'Hello world',
        '1234567890',
      );
    });

    it('should penalize countered user who tries to tag', async () => {
      const event: Partial<EventRequest['event']> = {
        type: 'message',
        subtype: 'channel_topic',
        user: 'U123',
        text: 'Hello @channel',
        channel: 'C123',
        ts: '1234567890',
      };

      mockSlackService.containsTag.mockReturnValue(true);
      mockCounterPersistenceService.isCounterMuzzled.mockResolvedValue(true);

      await service.handle({ event } as EventRequest);

      expect(mockCounterPersistenceService.addCounterMuzzleTime).toHaveBeenCalledWith('U123', ABUSE_PENALTY_TIME);
      expect(mockWebService.deleteMessage).toHaveBeenCalledWith('C123', '1234567890', 'U123');
      expect(mockWebService.sendMessage).toHaveBeenCalledWith('C123', expect.stringContaining('attempted to @'));
    });

    it('should handle topic changes without message text', async () => {
      const event: Partial<EventRequest['event']> = {
        type: 'message',
        subtype: 'channel_topic',
        user: 'U123',
        text: undefined,
        channel: 'C123',
        ts: '1234567890',
      };

      mockSlackService.containsTag.mockReturnValue(false);
      mockCounterPersistenceService.isCounterMuzzled.mockResolvedValue(false);

      await service.handle({ event } as EventRequest);

      expect(mockSlackService.containsTag).toHaveBeenCalledWith(undefined);
    });

    it('should ignore non-message events', async () => {
      const event: Partial<EventRequest['event']> = {
        type: 'app_mention',
        subtype: 'bot_message',
        user: 'U123',
        text: 'Hello',
      };

      (service as unknown as CounterServicePrivate).sendCounterMuzzledMessage = jest.fn();
      mockCounterPersistenceService.isCounterMuzzled.mockResolvedValue(false);

      await service.handle({ event } as EventRequest);

      expect(mockSlackService.containsTag).not.toHaveBeenCalled();
      expect((service as unknown as CounterServicePrivate).sendCounterMuzzledMessage).not.toHaveBeenCalled();
    });
  });
});
