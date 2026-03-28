import { getRepository, In } from 'typeorm';
import { SearchPersistenceService } from './search.persistence.service';
import { SlackChannel } from '../shared/db/models/SlackChannel';
import { SlackUser } from '../shared/db/models/SlackUser';

jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    getRepository: jest.fn(),
    In: jest.fn((ids) => ids),
  };
});

describe('SearchPersistenceService', () => {
  let service: SearchPersistenceService;
  const query = jest.fn();
  const find = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SearchPersistenceService();
    (getRepository as jest.Mock).mockReturnValue({ query, find });
    find.mockResolvedValue([]);
  });

  it('gets and de-duplicates users/channels for search filters', async () => {
    const userFind = jest.fn().mockResolvedValue([{ name: 'alice' }, { name: 'alice' }, { name: 'bob' }]);
    const channelFind = jest.fn().mockResolvedValue([{ name: 'general' }, { name: 'random' }, { name: 'general' }]);

    (getRepository as jest.Mock).mockReturnValueOnce({ find: userFind }).mockReturnValueOnce({ find: channelFind });

    const result = await service.getSearchFilters('T1');

    expect(result).toEqual({ users: ['alice', 'bob'], channels: ['general', 'random'] });
    expect(getRepository).toHaveBeenNthCalledWith(2, SlackChannel);
    expect(channelFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ teamId: 'T1', channelId: expect.anything() }) }),
    );
  });

  it('searches with no filters (default conditions only)', async () => {
    query.mockResolvedValue([{ id: 1, message: 'hello', name: 'alice' }]);

    const result = await service.searchMessages({ teamId: 'T1' });

    const [sql, params] = (query as jest.Mock).mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("message.message != ''");
    expect(sql).toContain('message.teamId = ?');
    expect(sql).toContain('slack_user.teamId = ?');
    expect(sql).toContain("message.channel LIKE 'C%'");
    expect(params).toEqual(['T1', 'T1', 100]);
    expect(result).toEqual({ messages: [{ id: 1, message: 'hello', name: 'alice' }], mentions: {} });
  });

  it('applies userName LIKE filter when userName is provided', async () => {
    query.mockResolvedValue([]);

    await service.searchMessages({ teamId: 'T1', userName: 'alice' });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('slack_user.name LIKE ?'), ['T1', 'T1', '%alice%', 100]);
  });

  it('applies channel LIKE filter when channel is provided', async () => {
    query.mockResolvedValue([]);

    await service.searchMessages({ teamId: 'T1', channel: 'general' });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('(message.channel LIKE ? OR slack_channel.name LIKE ?)'),
      ['T1', 'T1', '%general%', '%general%', 100],
    );
  });

  it('applies content LIKE filter when content is provided', async () => {
    query.mockResolvedValue([]);

    await service.searchMessages({ teamId: 'T1', content: 'hello' });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('message.message LIKE ?'), ['T1', 'T1', '%hello%', 100]);
  });

  it('applies all three filters combined', async () => {
    query.mockResolvedValue([]);

    await service.searchMessages({ teamId: 'T1', userName: 'alice', channel: 'general', content: 'hello' });

    const [sql, params] = (query as jest.Mock).mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('slack_user.name LIKE ?');
    expect(sql).toContain('(message.channel LIKE ? OR slack_channel.name LIKE ?)');
    expect(sql).toContain('message.message LIKE ?');
    expect(params).toEqual(['T1', 'T1', '%alice%', '%general%', '%general%', '%hello%', 100]);
  });

  it('uses the provided limit instead of the default', async () => {
    query.mockResolvedValue([]);

    await service.searchMessages({ teamId: 'T1', limit: 25 });

    const [, params] = (query as jest.Mock).mock.calls[0] as [string, unknown[]];
    expect(params[params.length - 1]).toBe(25);
  });

  it('clamps limit to MAX_LIMIT (1000) when provided value exceeds it', async () => {
    query.mockResolvedValue([]);

    await service.searchMessages({ teamId: 'T1', limit: 9999 });

    const [, params] = (query as jest.Mock).mock.calls[0] as [string, unknown[]];
    expect(params[params.length - 1]).toBe(1000);
  });

  it('uses default limit when provided value is below MIN_LIMIT', async () => {
    query.mockResolvedValue([]);

    await service.searchMessages({ teamId: 'T1', limit: 0 });

    const [, params] = (query as jest.Mock).mock.calls[0] as [string, unknown[]];
    expect(params[params.length - 1]).toBe(100);
  });

  it('uses default limit when provided value is NaN', async () => {
    query.mockResolvedValue([]);

    await service.searchMessages({ teamId: 'T1', limit: NaN });

    const [, params] = (query as jest.Mock).mock.calls[0] as [string, unknown[]];
    expect(params[params.length - 1]).toBe(100);
  });

  it('rethrows and logs errors from the database', async () => {
    const error = new Error('DB error');
    query.mockRejectedValue(error);

    await expect(service.searchMessages({ teamId: 'T1' })).rejects.toThrow('DB error');
  });

  it('resolves user and channel mentions found in message text', async () => {
    const userFind = jest.fn().mockResolvedValue([{ slackId: 'U123', name: 'alice' }]);
    const channelFind = jest.fn().mockResolvedValue([{ channelId: 'C456', name: 'general' }]);

    (getRepository as jest.Mock)
      .mockReturnValueOnce({ query })
      .mockReturnValueOnce({ find: userFind })
      .mockReturnValueOnce({ find: channelFind });

    query.mockResolvedValue([{ id: 1, message: 'Hello <@U123> check <#C456>', name: 'bob' }]);

    const result = await service.searchMessages({ teamId: 'T1' });

    expect(result.mentions).toEqual({ U123: 'alice', C456: 'general' });
    expect(userFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ slackId: In(['U123']), teamId: 'T1' }) }),
    );
    expect(channelFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ channelId: In(['C456']), teamId: 'T1' }) }),
    );
  });

  it('deduplicates mentions across multiple messages', async () => {
    const userFind = jest.fn().mockResolvedValue([{ slackId: 'U123', name: 'alice' }]);

    (getRepository as jest.Mock).mockReturnValueOnce({ query }).mockReturnValueOnce({ find: userFind });

    query.mockResolvedValue([
      { id: 1, message: 'Hey <@U123>', name: 'bob' },
      { id: 2, message: 'Also <@U123> mentioned here', name: 'carol' },
    ]);

    const result = await service.searchMessages({ teamId: 'T1' });

    expect(result.mentions).toEqual({ U123: 'alice' });
    expect(userFind).toHaveBeenCalledTimes(1);
  });

  it('skips mention lookups when no mentions exist in messages', async () => {
    query.mockResolvedValue([{ id: 1, message: 'plain text no mentions', name: 'alice' }]);

    const result = await service.searchMessages({ teamId: 'T1' });

    expect(result.mentions).toEqual({});
    expect(find).not.toHaveBeenCalled();
  });

  it('handles the |displayname variant in mention tokens', async () => {
    const userFind = jest.fn().mockResolvedValue([{ slackId: 'U789', name: 'dave' }]);

    (getRepository as jest.Mock).mockReturnValueOnce({ query }).mockReturnValueOnce({ find: userFind });

    query.mockResolvedValue([{ id: 1, message: 'Hi <@U789|dave>', name: 'bob' }]);

    const result = await service.searchMessages({ teamId: 'T1' });

    expect(result.mentions).toEqual({ U789: 'dave' });
  });

  it('uses SlackUser repo for user mentions and SlackChannel repo for channel mentions', async () => {
    const userFind = jest.fn().mockResolvedValue([{ slackId: 'U111', name: 'alice' }]);
    const channelFind = jest.fn().mockResolvedValue([{ channelId: 'C222', name: 'random' }]);

    (getRepository as jest.Mock)
      .mockReturnValueOnce({ query })
      .mockReturnValueOnce({ find: userFind })
      .mockReturnValueOnce({ find: channelFind });

    query.mockResolvedValue([{ id: 1, message: '<@U111> posted in <#C222>', name: 'bob' }]);

    await service.searchMessages({ teamId: 'T1' });

    expect(getRepository).toHaveBeenCalledWith(SlackUser);
    expect(getRepository).toHaveBeenCalledWith(SlackChannel);
  });
});
