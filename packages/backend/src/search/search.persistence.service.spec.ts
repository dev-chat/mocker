import { vi } from 'vitest';
import { getRepository } from 'typeorm';
import { SearchPersistenceService } from './search.persistence.service';
import { SlackChannel } from '../shared/db/models/SlackChannel';

vi.mock('typeorm', async () => {
  const actual = await vi.importActual('typeorm');
  return {
    ...actual,
    getRepository: vi.fn(),
  };
});

describe('SearchPersistenceService', () => {
  let service: SearchPersistenceService;
  const query = vi.fn();
  const find = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    service = new SearchPersistenceService();
    (getRepository as Mock).mockReturnValue({ query, find });
    find.mockResolvedValue([]);
    // Default: count query returns 0 total, data query returns empty rows,
    // and any subsequent mention-resolution query also returns empty rows.
    query.mockImplementation((sql: string) =>
      sql.trimStart().startsWith('SELECT COUNT') ? Promise.resolve([{ total: 0 }]) : Promise.resolve([]),
    );
  });

  it('gets and de-duplicates users/channels for search filters', async () => {
    const userFind = vi.fn().mockResolvedValue([{ name: 'alice' }, { name: 'alice' }, { name: 'bob' }]);
    const channelFind = vi.fn().mockResolvedValue([{ name: 'general' }, { name: 'random' }, { name: 'general' }]);

    (getRepository as Mock).mockReturnValueOnce({ find: userFind }).mockReturnValueOnce({ find: channelFind });

    const result = await service.getSearchFilters('T1');

    expect(result).toEqual({ users: ['alice', 'bob'], channels: ['general', 'random'] });
    expect(getRepository).toHaveBeenNthCalledWith(2, SlackChannel);
    expect(channelFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ teamId: 'T1', channelId: expect.anything() }) }),
    );
  });

  it('searches with no filters (default conditions only)', async () => {
    query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([{ id: 1, message: 'hello', name: 'alice' }]);

    const result = await service.searchMessages({ teamId: 'T1' });

    // calls[0] = count query, calls[1] = data query
    const [countSql, countParams] = (query as Mock).mock.calls[0] as [string, unknown[]];
    const [dataSql, dataParams] = (query as Mock).mock.calls[1] as [string, unknown[]];

    expect(countSql).toContain("message.message != ''");
    expect(countSql).toContain('message.teamId = ?');
    expect(countSql).toContain('slack_user.teamId = ?');
    expect(countSql).toContain("message.channel LIKE 'C%'");
    expect(countParams).toEqual(['T1', 'T1']);

    expect(dataSql).toContain("message.message != ''");
    expect(dataSql).toContain('ORDER BY message.createdAt DESC');
    expect(dataParams).toEqual(['T1', 'T1', 100, 0]);

    expect(result).toEqual({ messages: [{ id: 1, message: 'hello', name: 'alice' }], mentions: {}, total: 1 });
  });

  it('applies userName LIKE filter when userName is provided', async () => {
    query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

    await service.searchMessages({ teamId: 'T1', userName: 'alice' });

    const [, dataParams] = (query as Mock).mock.calls[1] as [string, unknown[]];
    expect(dataParams).toEqual(['T1', 'T1', '%alice%', 100, 0]);

    const [countSql] = (query as Mock).mock.calls[0] as [string, unknown[]];
    expect(countSql).toContain('slack_user.name LIKE ?');
  });

  it('applies channel LIKE filter when channel is provided', async () => {
    query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

    await service.searchMessages({ teamId: 'T1', channel: 'general' });

    const [countSql, countParams] = (query as Mock).mock.calls[0] as [string, unknown[]];
    expect(countSql).toContain('(message.channel LIKE ? OR slack_channel.name LIKE ?)');
    expect(countParams).toEqual(['T1', 'T1', '%general%', '%general%']);

    const [, dataParams] = (query as Mock).mock.calls[1] as [string, unknown[]];
    expect(dataParams).toEqual(['T1', 'T1', '%general%', '%general%', 100, 0]);
  });

  it('applies content LIKE filter when content is provided', async () => {
    query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

    await service.searchMessages({ teamId: 'T1', content: 'hello' });

    const [countSql, countParams] = (query as Mock).mock.calls[0] as [string, unknown[]];
    expect(countSql).toContain('message.message LIKE ?');
    expect(countParams).toEqual(['T1', 'T1', '%hello%']);

    const [, dataParams] = (query as Mock).mock.calls[1] as [string, unknown[]];
    expect(dataParams).toEqual(['T1', 'T1', '%hello%', 100, 0]);
  });

  it('applies all three filters combined', async () => {
    query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

    await service.searchMessages({ teamId: 'T1', userName: 'alice', channel: 'general', content: 'hello' });

    const [countSql, countParams] = (query as Mock).mock.calls[0] as [string, unknown[]];
    expect(countSql).toContain('slack_user.name LIKE ?');
    expect(countSql).toContain('(message.channel LIKE ? OR slack_channel.name LIKE ?)');
    expect(countSql).toContain('message.message LIKE ?');
    expect(countParams).toEqual(['T1', 'T1', '%alice%', '%general%', '%general%', '%hello%']);

    const [, dataParams] = (query as Mock).mock.calls[1] as [string, unknown[]];
    expect(dataParams).toEqual(['T1', 'T1', '%alice%', '%general%', '%general%', '%hello%', 100, 0]);
  });

  it('uses the provided limit instead of the default', async () => {
    query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

    await service.searchMessages({ teamId: 'T1', limit: 25 });

    const [, dataParams] = (query as Mock).mock.calls[1] as [string, unknown[]];
    expect(dataParams).toEqual(['T1', 'T1', 25, 0]);
  });

  it('clamps limit to MAX_LIMIT (1000) when provided value exceeds it', async () => {
    query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

    await service.searchMessages({ teamId: 'T1', limit: 9999 });

    const [, dataParams] = (query as Mock).mock.calls[1] as [string, unknown[]];
    expect(dataParams[dataParams.length - 2]).toBe(1000);
  });

  it('uses default limit when provided value is below MIN_LIMIT', async () => {
    query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

    await service.searchMessages({ teamId: 'T1', limit: 0 });

    const [, dataParams] = (query as Mock).mock.calls[1] as [string, unknown[]];
    expect(dataParams[dataParams.length - 2]).toBe(100);
  });

  it('uses default limit when provided value is NaN', async () => {
    query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

    await service.searchMessages({ teamId: 'T1', limit: NaN });

    const [, dataParams] = (query as Mock).mock.calls[1] as [string, unknown[]];
    expect(dataParams[dataParams.length - 2]).toBe(100);
  });

  it('applies the provided offset to the data query', async () => {
    query.mockResolvedValueOnce([{ total: 50 }]).mockResolvedValueOnce([]);

    await service.searchMessages({ teamId: 'T1', offset: 25 });

    const [, dataParams] = (query as Mock).mock.calls[1] as [string, unknown[]];
    expect(dataParams[dataParams.length - 1]).toBe(25);
  });

  it('defaults offset to 0 when not provided', async () => {
    query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

    await service.searchMessages({ teamId: 'T1' });

    const [, dataParams] = (query as Mock).mock.calls[1] as [string, unknown[]];
    expect(dataParams[dataParams.length - 1]).toBe(0);
  });

  it('defaults offset to 0 when a negative value is provided', async () => {
    query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

    await service.searchMessages({ teamId: 'T1', offset: -10 });

    const [, dataParams] = (query as Mock).mock.calls[1] as [string, unknown[]];
    expect(dataParams[dataParams.length - 1]).toBe(0);
  });

  it('returns total from the count query', async () => {
    query.mockResolvedValueOnce([{ total: '42' }]).mockResolvedValueOnce([]);

    const result = await service.searchMessages({ teamId: 'T1' });

    expect(result.total).toBe(42);
  });

  it('rethrows and logs errors from the database', async () => {
    const error = new Error('DB error');
    query.mockRejectedValue(error);

    await expect(service.searchMessages({ teamId: 'T1' })).rejects.toThrow('DB error');
  });

  it('resolves user and channel mentions found in message text', async () => {
    query
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ id: 1, message: 'Hello <@U123> check <#C456>', name: 'bob' }])
      .mockResolvedValueOnce([
        { id: 'U123', name: 'alice' },
        { id: 'C456', name: 'general' },
      ]);

    const result = await service.searchMessages({ teamId: 'T1' });

    expect(result.mentions).toEqual({ U123: 'alice', C456: 'general' });

    const [mentionSql, mentionParams] = (query as Mock).mock.calls[2] as [string, unknown[]];
    expect(mentionSql).toContain('UNION ALL');
    expect(mentionSql).toContain('slack_user');
    expect(mentionSql).toContain('slack_channel');
    expect(mentionParams).toContain('U123');
    expect(mentionParams).toContain('C456');
    expect(mentionParams).toContain('T1');
  });

  it('deduplicates mentions across multiple messages', async () => {
    query
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([
        { id: 1, message: 'Hey <@U123>', name: 'bob' },
        { id: 2, message: 'Also <@U123> mentioned here', name: 'carol' },
      ])
      .mockResolvedValueOnce([{ id: 'U123', name: 'alice' }]);

    const result = await service.searchMessages({ teamId: 'T1' });

    expect(result.mentions).toEqual({ U123: 'alice' });
    // Third query call should only contain one occurrence of U123
    const [mentionSql, mentionParams] = (query as Mock).mock.calls[2] as [string, unknown[]];
    expect(mentionParams.filter((p) => p === 'U123')).toHaveLength(1);
    expect(mentionSql).not.toContain('UNION ALL');
  });

  it('skips mention lookups when no mentions exist in messages', async () => {
    query
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ id: 1, message: 'plain text no mentions', name: 'alice' }]);

    const result = await service.searchMessages({ teamId: 'T1' });

    expect(result.mentions).toEqual({});
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('handles the |displayname variant in mention tokens', async () => {
    query
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ id: 1, message: 'Hi <@U789|dave>', name: 'bob' }])
      .mockResolvedValueOnce([{ id: 'U789', name: 'dave' }]);

    const result = await service.searchMessages({ teamId: 'T1' });

    expect(result.mentions).toEqual({ U789: 'dave' });
  });

  it('resolves user-only mentions using a query without UNION ALL', async () => {
    query
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ id: 1, message: 'Hey <@U111>', name: 'bob' }])
      .mockResolvedValueOnce([{ id: 'U111', name: 'alice' }]);

    const result = await service.searchMessages({ teamId: 'T1' });

    expect(result.mentions).toEqual({ U111: 'alice' });
    const [mentionSql] = (query as Mock).mock.calls[2] as [string, unknown[]];
    expect(mentionSql).toContain('slack_user');
    expect(mentionSql).not.toContain('UNION ALL');
  });

  it('resolves both user and channel mentions using a single UNION ALL query', async () => {
    query
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ id: 1, message: '<@U111> posted in <#C222>', name: 'bob' }])
      .mockResolvedValueOnce([
        { id: 'U111', name: 'alice' },
        { id: 'C222', name: 'random' },
      ]);

    const result = await service.searchMessages({ teamId: 'T1' });

    expect(result.mentions).toEqual({ U111: 'alice', C222: 'random' });
    expect(query).toHaveBeenCalledTimes(3);
    const [mentionSql] = (query as Mock).mock.calls[2] as [string, unknown[]];
    expect(mentionSql).toContain('UNION ALL');
  });
});
