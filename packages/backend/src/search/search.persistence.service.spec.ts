import { getRepository } from 'typeorm';
import { SearchPersistenceService } from './search.persistence.service';
import { SlackChannel } from '../shared/db/models/SlackChannel';

jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    getRepository: jest.fn(),
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
    // By default the second query call (mention resolution) returns empty rows
    query.mockResolvedValue([]);
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
    query.mockResolvedValueOnce([{ id: 1, message: 'hello', name: 'alice' }]).mockResolvedValueOnce([]);

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
    query
      .mockResolvedValueOnce([{ id: 1, message: 'Hello <@U123> check <#C456>', name: 'bob' }])
      .mockResolvedValueOnce([
        { id: 'U123', name: 'alice' },
        { id: 'C456', name: 'general' },
      ]);

    const result = await service.searchMessages({ teamId: 'T1' });

    expect(result.mentions).toEqual({ U123: 'alice', C456: 'general' });

    const [mentionSql, mentionParams] = (query as jest.Mock).mock.calls[1] as [string, unknown[]];
    expect(mentionSql).toContain('UNION ALL');
    expect(mentionSql).toContain('slack_user');
    expect(mentionSql).toContain('slack_channel');
    expect(mentionParams).toContain('U123');
    expect(mentionParams).toContain('C456');
    expect(mentionParams).toContain('T1');
  });

  it('deduplicates mentions across multiple messages', async () => {
    query
      .mockResolvedValueOnce([
        { id: 1, message: 'Hey <@U123>', name: 'bob' },
        { id: 2, message: 'Also <@U123> mentioned here', name: 'carol' },
      ])
      .mockResolvedValueOnce([{ id: 'U123', name: 'alice' }]);

    const result = await service.searchMessages({ teamId: 'T1' });

    expect(result.mentions).toEqual({ U123: 'alice' });
    // Second query call should only contain one occurrence of U123
    const [mentionSql, mentionParams] = (query as jest.Mock).mock.calls[1] as [string, unknown[]];
    expect(mentionParams.filter((p) => p === 'U123')).toHaveLength(1);
    expect(mentionSql).not.toContain('UNION ALL');
  });

  it('skips mention lookups when no mentions exist in messages', async () => {
    query.mockResolvedValueOnce([{ id: 1, message: 'plain text no mentions', name: 'alice' }]);

    const result = await service.searchMessages({ teamId: 'T1' });

    expect(result.mentions).toEqual({});
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('handles the |displayname variant in mention tokens', async () => {
    query
      .mockResolvedValueOnce([{ id: 1, message: 'Hi <@U789|dave>', name: 'bob' }])
      .mockResolvedValueOnce([{ id: 'U789', name: 'dave' }]);

    const result = await service.searchMessages({ teamId: 'T1' });

    expect(result.mentions).toEqual({ U789: 'dave' });
  });

  it('resolves user-only mentions using a query without UNION ALL', async () => {
    query
      .mockResolvedValueOnce([{ id: 1, message: 'Hey <@U111>', name: 'bob' }])
      .mockResolvedValueOnce([{ id: 'U111', name: 'alice' }]);

    const result = await service.searchMessages({ teamId: 'T1' });

    expect(result.mentions).toEqual({ U111: 'alice' });
    const [mentionSql] = (query as jest.Mock).mock.calls[1] as [string, unknown[]];
    expect(mentionSql).toContain('slack_user');
    expect(mentionSql).not.toContain('UNION ALL');
  });

  it('resolves both user and channel mentions using a single UNION ALL query', async () => {
    query.mockResolvedValueOnce([{ id: 1, message: '<@U111> posted in <#C222>', name: 'bob' }]).mockResolvedValueOnce([
      { id: 'U111', name: 'alice' },
      { id: 'C222', name: 'random' },
    ]);

    const result = await service.searchMessages({ teamId: 'T1' });

    expect(result.mentions).toEqual({ U111: 'alice', C222: 'random' });
    expect(query).toHaveBeenCalledTimes(2);
    const [mentionSql] = (query as jest.Mock).mock.calls[1] as [string, unknown[]];
    expect(mentionSql).toContain('UNION ALL');
  });
});
