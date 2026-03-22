import { EventService } from './event.service';
import type { EventRequest } from '../shared/models/slack/slack-models';

type EventServiceDependencies = EventService & {
  eventPersistenceService: typeof eventPersistenceService;
  historyPersistenceService: typeof historyPersistenceService;
  slackService: typeof slackService;
  muzzleService: typeof muzzleService;
  backfireService: typeof backfireService;
  reactionService: typeof reactionService;
  counterService: typeof counterService;
  aiService: typeof aiService;
  suppressorService: typeof suppressorService;
};

describe('EventService', () => {
  let service: EventService;

  const eventPersistenceService = {
    performSentimentAnalysis: jest.fn(),
    logActivity: jest.fn(),
  };
  const historyPersistenceService = {
    logHistory: jest.fn(),
  };
  const slackService = { handle: jest.fn() };
  const muzzleService = { handle: jest.fn() };
  const backfireService = { handle: jest.fn() };
  const reactionService = { handle: jest.fn() };
  const counterService = { handle: jest.fn() };
  const aiService = { handle: jest.fn() };
  const suppressorService = { handleBotMessage: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EventService();
    const dependencyTarget = service as unknown as EventServiceDependencies;
    dependencyTarget.eventPersistenceService = eventPersistenceService;
    dependencyTarget.historyPersistenceService = historyPersistenceService;
    dependencyTarget.slackService = slackService;
    dependencyTarget.muzzleService = muzzleService;
    dependencyTarget.backfireService = backfireService;
    dependencyTarget.reactionService = reactionService;
    dependencyTarget.counterService = counterService;
    dependencyTarget.aiService = aiService;
    dependencyTarget.suppressorService = suppressorService;

    historyPersistenceService.logHistory.mockResolvedValue(undefined);
    slackService.handle.mockResolvedValue(undefined);
    muzzleService.handle.mockResolvedValue(undefined);
    backfireService.handle.mockResolvedValue(undefined);
    reactionService.handle.mockResolvedValue(undefined);
    counterService.handle.mockResolvedValue(undefined);
    aiService.handle.mockResolvedValue(undefined);
    suppressorService.handleBotMessage.mockResolvedValue(undefined);
  });

  it('logs sentiment and history for message events', async () => {
    const req = {
      team_id: 'T1',
      event: { type: 'message', user: 'U1', channel: 'C1', text: 'hello' },
    } as EventRequest;

    await service.handleEvent(req);

    expect(eventPersistenceService.performSentimentAnalysis).toHaveBeenCalledWith('U1', 'T1', 'C1', 'hello');
    expect(historyPersistenceService.logHistory).toHaveBeenCalledWith(req);
    expect(eventPersistenceService.logActivity).not.toHaveBeenCalled();
  });

  it('logs activity for non-message events except user_profile_changed', async () => {
    await service.handleEvent({ team_id: 'T1', event: { type: 'reaction_added' } } as EventRequest);

    expect(eventPersistenceService.logActivity).toHaveBeenCalled();
    expect(historyPersistenceService.logHistory).not.toHaveBeenCalled();
  });

  it('does nothing for user_profile_changed', async () => {
    await service.handleEvent({ team_id: 'T1', event: { type: 'user_profile_changed' } } as EventRequest);

    expect(eventPersistenceService.logActivity).not.toHaveBeenCalled();
    expect(eventPersistenceService.performSentimentAnalysis).not.toHaveBeenCalled();
  });

  it('runs all handlers after event processing', async () => {
    const req = { team_id: 'T1', event: { type: 'message', user: 'U1', channel: 'C1', text: 'hey' } } as EventRequest;

    await service.handle(req);

    expect(slackService.handle).toHaveBeenCalledWith(req);
    expect(muzzleService.handle).toHaveBeenCalledWith(req);
    expect(backfireService.handle).toHaveBeenCalledWith(req);
    expect(counterService.handle).toHaveBeenCalledWith(req);
    expect(reactionService.handle).toHaveBeenCalledWith(req);
    expect(suppressorService.handleBotMessage).toHaveBeenCalledWith(req);
    expect(aiService.handle).toHaveBeenCalledWith(req);
  });

  it('logs and rethrows when a handler fails', async () => {
    const err = new Error('handler failed');
    const loggerSpy = jest.spyOn(service.logger, 'error').mockImplementation(() => undefined);
    aiService.handle.mockRejectedValue(err);

    await expect(
      service.handle({
        team_id: 'T1',
        event: { type: 'message', user: 'U1', channel: 'C1', text: 'hey' },
      } as EventRequest),
    ).rejects.toThrow('handler failed');

    expect(loggerSpy).toHaveBeenCalledWith(
      'Error handling event',
      expect.objectContaining({
        context: {
          eventType: 'message',
          teamId: 'T1',
          channelId: 'C1',
          userId: 'U1',
        },
        error: expect.objectContaining({ message: 'handler failed', name: 'Error' }),
      }),
    );
  });
});
