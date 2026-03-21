import { ReactionService } from './reaction.service';
import type { EventRequest } from '../shared/models/slack/slack-models';

type ReactionDependencies = ReactionService & {
  reactionPersistenceService: {
    saveReaction: jest.Mock;
    removeReaction: jest.Mock;
  };
};

describe('ReactionService', () => {
  let service: ReactionService;
  const saveReaction = jest.fn();
  const removeReaction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReactionService();
    (service as unknown as ReactionDependencies).reactionPersistenceService = { saveReaction, removeReaction };
    saveReaction.mockResolvedValue(undefined);
  });

  it('logs added reaction when valid and user differs from item_user', () => {
    service.handle({
      event: { type: 'reaction_added', user: 'U1', item_user: 'U2', reaction: '+1' },
      team_id: 'T1',
    } as EventRequest);

    expect(saveReaction).toHaveBeenCalledWith(expect.objectContaining({ reaction: '+1' }), 1, 'T1');
    expect(removeReaction).not.toHaveBeenCalled();
  });

  it('removes reaction when reaction_removed is valid', () => {
    service.handle({
      event: { type: 'reaction_removed', user: 'U1', item_user: 'U2', reaction: '-1' },
      team_id: 'T1',
    } as EventRequest);

    expect(removeReaction).toHaveBeenCalledWith(expect.objectContaining({ reaction: '-1' }), 'T1');
    expect(saveReaction).not.toHaveBeenCalled();
  });

  it('does not log when user reacts to own message', () => {
    service.handle({
      event: { type: 'reaction_added', user: 'U1', item_user: 'U1', reaction: '+1' },
      team_id: 'T1',
    } as EventRequest);

    expect(saveReaction).not.toHaveBeenCalled();
    expect(removeReaction).not.toHaveBeenCalled();
  });

  it('does not log unsupported reaction values', () => {
    service.handle({
      event: { type: 'reaction_added', user: 'U1', item_user: 'U2', reaction: 'not_a_real_reaction' },
      team_id: 'T1',
    } as EventRequest);

    expect(saveReaction).not.toHaveBeenCalled();
  });

  it('logs persistence errors on added reactions', async () => {
    const err = new Error('db error');
    const loggerSpy = jest.spyOn(service.logger, 'error').mockImplementation(() => undefined);
    saveReaction.mockRejectedValue(err);

    service.handle({
      event: { type: 'reaction_added', user: 'U1', item_user: 'U2', reaction: '+1' },
      team_id: 'T1',
    } as EventRequest);
    await Promise.resolve();

    expect(loggerSpy).toHaveBeenCalledWith(err);
  });
});
