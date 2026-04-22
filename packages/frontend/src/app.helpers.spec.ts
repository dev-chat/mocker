import { getDisplayedMessages } from '@/app.helpers';
import type { Message } from '@/app.model';

const messages: Message[] = [
  {
    id: 1,
    name: 'Zoe',
    channel: 'general',
    channelName: 'General',
    message: 'Beta update',
    teamId: 'T1',
    createdAt: '2026-04-21T10:00:00.000Z',
    slackId: 'U1',
  },
  {
    id: 2,
    name: 'alex',
    channel: 'random',
    message: 'alpha note',
    teamId: 'T1',
    createdAt: '2026-04-20T10:00:00.000Z',
    slackId: 'U2',
  },
  {
    id: 3,
    name: 'Mia',
    channel: 'dev',
    channelName: 'Engineering',
    message: 'Gamma topic',
    teamId: 'T1',
    createdAt: '2026-04-22T10:00:00.000Z',
    slackId: 'U3',
  },
];

describe('getDisplayedMessages', () => {
  it('filters by name, channel, and message text case-insensitively', () => {
    expect(getDisplayedMessages(messages, '  zoe ', 'name', 'asc')).toHaveLength(1);
    expect(getDisplayedMessages(messages, 'engineering', 'channel', 'asc')).toHaveLength(1);
    expect(getDisplayedMessages(messages, 'ALPHA', 'message', 'asc')).toHaveLength(1);
  });

  it('sorts by createdAt in ascending and descending order', () => {
    const asc = getDisplayedMessages(messages, '', 'createdAt', 'asc');
    const desc = getDisplayedMessages(messages, '', 'createdAt', 'desc');

    expect(asc.map((m) => m.id)).toEqual([2, 1, 3]);
    expect(desc.map((m) => m.id)).toEqual([3, 1, 2]);
  });

  it('sorts by name using locale comparison', () => {
    const sorted = getDisplayedMessages(messages, '', 'name', 'asc');
    expect(sorted.map((m) => m.name)).toEqual(['alex', 'Mia', 'Zoe']);
  });

  it('sorts by channel using channelName fallback when present', () => {
    const sorted = getDisplayedMessages(messages, '', 'channel', 'asc');
    expect(sorted.map((m) => m.id)).toEqual([3, 1, 2]);
  });

  it('sorts by message when sort key is message', () => {
    const sorted = getDisplayedMessages(messages, '', 'message', 'asc');
    expect(sorted.map((m) => m.message)).toEqual(['alpha note', 'Beta update', 'Gamma topic']);
  });

  it('handles missing channel values when filtering', () => {
    const input = [
      ...messages,
      {
        id: 4,
        name: 'No Channel',
        channel: undefined,
        channelName: undefined,
        message: 'No channel text',
        teamId: 'T1',
        createdAt: '2026-04-23T10:00:00.000Z',
        slackId: 'U4',
      } as unknown as Message,
    ];

    const filtered = getDisplayedMessages(input, 'no channel', 'name', 'asc');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(4);
  });
});
