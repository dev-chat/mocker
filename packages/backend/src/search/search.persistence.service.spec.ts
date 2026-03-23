import { getRepository } from 'typeorm';
import { SearchPersistenceService } from './search.persistence.service';

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

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SearchPersistenceService();
    (getRepository as jest.Mock).mockReturnValue({ query });
  });

  it('searches with no filters (default conditions only)', async () => {
    query.mockResolvedValue([{ id: 1, message: 'hello', name: 'alice' }]);

    const result = await service.searchMessages({});

    expect(query).toHaveBeenCalledWith(expect.stringContaining("message.message != ''"), [100]);
    expect(result).toEqual([{ id: 1, message: 'hello', name: 'alice' }]);
  });

  it('applies userName LIKE filter when userName is provided', async () => {
    query.mockResolvedValue([]);

    await service.searchMessages({ userName: 'alice' });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('slack_user.name LIKE ?'), ['%alice%', 100]);
  });

  it('applies channel LIKE filter when channel is provided', async () => {
    query.mockResolvedValue([]);

    await service.searchMessages({ channel: 'general' });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('message.channel LIKE ?'), ['%general%', 100]);
  });

  it('applies content LIKE filter when content is provided', async () => {
    query.mockResolvedValue([]);

    await service.searchMessages({ content: 'hello' });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('message.message LIKE ?'), ['%hello%', 100]);
  });

  it('applies all three filters combined', async () => {
    query.mockResolvedValue([]);

    await service.searchMessages({ userName: 'alice', channel: 'general', content: 'hello' });

    const [sql, params] = (query as jest.Mock).mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('slack_user.name LIKE ?');
    expect(sql).toContain('message.channel LIKE ?');
    expect(sql).toContain('message.message LIKE ?');
    expect(params).toEqual(['%alice%', '%general%', '%hello%', 100]);
  });

  it('uses the provided limit instead of the default', async () => {
    query.mockResolvedValue([]);

    await service.searchMessages({ limit: 25 });

    const [, params] = (query as jest.Mock).mock.calls[0] as [string, unknown[]];
    expect(params[params.length - 1]).toBe(25);
  });

  it('clamps limit to MAX_LIMIT (500) when provided value exceeds it', async () => {
    query.mockResolvedValue([]);

    await service.searchMessages({ limit: 9999 });

    const [, params] = (query as jest.Mock).mock.calls[0] as [string, unknown[]];
    expect(params[params.length - 1]).toBe(500);
  });

  it('uses default limit when provided value is below MIN_LIMIT', async () => {
    query.mockResolvedValue([]);

    await service.searchMessages({ limit: 0 });

    const [, params] = (query as jest.Mock).mock.calls[0] as [string, unknown[]];
    expect(params[params.length - 1]).toBe(100);
  });

  it('uses default limit when provided value is NaN', async () => {
    query.mockResolvedValue([]);

    await service.searchMessages({ limit: NaN });

    const [, params] = (query as jest.Mock).mock.calls[0] as [string, unknown[]];
    expect(params[params.length - 1]).toBe(100);
  });

  it('rethrows and logs errors from the database', async () => {
    const error = new Error('DB error');
    query.mockRejectedValue(error);

    await expect(service.searchMessages({})).rejects.toThrow('DB error');
  });
});
