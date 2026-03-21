import { getRepository } from 'typeorm';
import { EventPersistenceService } from './event.persistence.service';
import { EventRequest } from '../shared/models/slack/slack-models';

type EventPersistencePrivate = EventPersistenceService & {
  analyzeSentimentAndStore: (userId: string, teamId: string, channelId: string, text: string) => Promise<unknown>;
};

jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    getRepository: jest.fn(),
  };
});

describe('EventPersistenceService', () => {
  let service: EventPersistenceService;
  const findOne = jest.fn();
  const insert = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EventPersistenceService();
    (getRepository as jest.Mock).mockReturnValue({ findOne, insert });
  });

  it('skips activity logging for invalid user', async () => {
    await service.logActivity({ team_id: 'T1', event: { type: 'message', user: 1 } } as unknown as EventRequest);

    expect(findOne).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('skips activity logging for user_profile_changed', async () => {
    await service.logActivity({ team_id: 'T1', event: { type: 'user_profile_changed', user: 'U1' } } as EventRequest);

    expect(findOne).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('logs activity for valid request', async () => {
    findOne.mockResolvedValue({ id: 5, slackId: 'U1' });
    insert.mockResolvedValue({ identifiers: [{ id: 1 }] });

    await service.logActivity({
      team_id: 'T1',
      event: { type: 'message', user: 'U1', channel: 'C1', channel_type: 'channel' },
    } as EventRequest);

    expect(findOne).toHaveBeenCalledWith({ where: { slackId: 'U1', teamId: 'T1' } });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ channel: 'C1', eventType: 'message', teamId: 'T1' }));
  });

  it('falls back to item channel when event channel is missing', async () => {
    findOne.mockResolvedValue({ id: 5, slackId: 'U1' });
    insert.mockResolvedValue({ identifiers: [{ id: 1 }] });

    await service.logActivity({
      team_id: 'T1',
      event: { type: 'reaction_added', user: 'U1', item: { channel: 'C9' }, channel_type: 'channel' },
    } as EventRequest);

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ channel: 'C9' }));
  });

  it('delegates performSentimentAnalysis to analyze-and-store flow', () => {
    const privateService = service as unknown as EventPersistencePrivate;
    const spy = jest.spyOn(privateService, 'analyzeSentimentAndStore').mockResolvedValue({});

    service.performSentimentAnalysis('U1', 'T1', 'C1', 'text');

    expect(spy).toHaveBeenCalledWith('U1', 'T1', 'C1', 'text');
  });

  it('stores sentiment analysis result', async () => {
    const analyzeSpy = jest.spyOn(service.sentiment, 'analyze').mockReturnValue({ comparative: 1.5 } as never);
    insert.mockResolvedValue({ identifiers: [{ id: 7 }] });

    const out = await (service as unknown as EventPersistencePrivate).analyzeSentimentAndStore(
      'U1',
      'T1',
      'C1',
      'great work',
    );

    expect(analyzeSpy).toHaveBeenCalledWith('great work', expect.objectContaining({ extras: expect.any(Object) }));
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ sentiment: 1.5, teamId: 'T1', userId: 'U1', channelId: 'C1' }),
    );
    expect(out).toEqual({ identifiers: [{ id: 7 }] });
  });
});
