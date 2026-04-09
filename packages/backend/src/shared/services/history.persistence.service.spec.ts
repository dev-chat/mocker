import { vi } from 'vitest';
import { getRepository } from 'typeorm';
import { HistoryPersistenceService } from './history.persistence.service';
import type { EventRequest, SlashCommandRequest } from '../models/slack/slack-models';

vi.mock('typeorm', async () => {
  const actual = await vi.importActual('typeorm');
  return {
    ...actual,
    getRepository: vi.fn(),
  };
});

describe('HistoryPersistenceService', () => {
  let service: HistoryPersistenceService;
  const findOne = vi.fn();
  const insert = vi.fn();
  const query = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new HistoryPersistenceService();
    (getRepository as Mock).mockReturnValue({ findOne, insert, query });
  });

  it('skips history logging for invalid users and profile change events', async () => {
    await expect(
      service.logHistory({ team_id: 'T1', event: { type: 'message', user: 123 } } as unknown as EventRequest),
    ).resolves.toBeUndefined();
    await expect(
      service.logHistory({ team_id: 'T1', event: { type: 'user_profile_changed', user: 'U1' } } as EventRequest),
    ).resolves.toBeUndefined();

    expect(findOne).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('logs history for valid events', async () => {
    findOne.mockResolvedValue({ id: 10, slackId: 'U1' });
    insert.mockResolvedValue({ identifiers: [{ id: 1 }] });

    const out = await service.logHistory({
      team_id: 'T1',
      event: { type: 'message', user: 'U1', channel: 'C1', text: 'hello' },
    } as EventRequest);

    expect(findOne).toHaveBeenCalledWith({ where: { slackId: 'U1', teamId: 'T1' } });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'C1', teamId: 'T1', message: 'hello', userId: { id: 10, slackId: 'U1' } }),
    );
    expect(out).toEqual({ identifiers: [{ id: 1 }] });
  });

  it('falls back to item channel when event channel missing', async () => {
    findOne.mockResolvedValue({ id: 10, slackId: 'U1' });
    insert.mockResolvedValue({ identifiers: [{ id: 2 }] });

    await service.logHistory({
      team_id: 'T1',
      event: { type: 'message', user: 'U1', item: { channel: 'C9' }, text: 'hello' },
    } as EventRequest);

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ channel: 'C9' }));
  });

  it('returns five-minute message count', async () => {
    query.mockResolvedValue([{ count: 3 }]);

    const count = await service.getLastFiveMinutesCount('T1', 'C1');

    expect(count).toBe(3);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INTERVAL 5 MINUTE'), ['T1', 'C1']);
  });

  it('queries daily and hourly history intervals', async () => {
    query.mockResolvedValue([{ id: 1 }]);

    await service.getHistory({ team_id: 'T1', channel_id: 'C1' } as SlashCommandRequest, true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INTERVAL 1 DAY'), ['T1', 'C1', 'T1', 'C1']);

    await service.getHistory({ team_id: 'T1', channel_id: 'C1' } as SlashCommandRequest, false);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INTERVAL 1 HOUR'), ['T1', 'C1', 'T1', 'C1']);
  });

  it('supports options with defaults and exclude user filter', async () => {
    query.mockResolvedValue([{ id: 1 }]);

    await service.getHistoryWithOptions({ teamId: 'T1', channelId: 'C1' });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('LIMIT ?'), ['T1', 'C1', 200, 'T1', 'C1', 120]);

    await service.getHistoryWithOptions({
      teamId: 'T1',
      channelId: 'C1',
      maxMessages: 50,
      timeWindowMinutes: 30,
      excludeUserId: 99,
    });

    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('message.userIdId != 99'), [
      'T1',
      'C1',
      50,
      'T1',
      'C1',
      30,
    ]);
  });

  it('queries the last 24 hours of messages for a channel', async () => {
    const rows = [{ id: 1, message: 'hello', name: 'Alice', slackId: 'U1' }];
    query.mockResolvedValue(rows);

    const result = await service.getLast24HoursForChannel('T1', 'C1');

    expect(query).toHaveBeenCalledWith(expect.stringContaining('INTERVAL 1 DAY'), ['T1', 'C1']);
    expect(result).toEqual(rows);
  });

  it('throws and logs when getLast24HoursForChannel query fails', async () => {
    const err = new Error('DB fail');
    query.mockRejectedValue(err);

    await expect(service.getLast24HoursForChannel('T1', 'C1')).rejects.toThrow('DB fail');
  });
});
