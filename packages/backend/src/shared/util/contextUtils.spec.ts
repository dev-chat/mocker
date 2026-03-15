import { resolveUserMentions, truncateToTokenBudget } from './contextUtils';
import { MessageWithName } from '../models/message/message-with-name';

describe('resolveUserMentions', () => {
  it('should replace Slack user IDs with display names', async () => {
    const text = 'Hey <@U123ABC> what do you think about <@U456DEF> idea?';
    const lookupFn = async (userId: string) => {
      const names: Record<string, string> = { U123ABC: 'steve', U456DEF: 'yale' };
      return names[userId];
    };
    const result = await resolveUserMentions(text, lookupFn);
    expect(result).toBe('Hey @steve what do you think about @yale idea?');
  });

  it('should leave unresolved IDs as-is', async () => {
    const text = 'Hey <@UUNKNOWN> how are you?';
    const lookupFn = async () => undefined;
    const result = await resolveUserMentions(text, lookupFn);
    expect(result).toBe('Hey <@UUNKNOWN> how are you?');
  });

  it('should handle text with no mentions', async () => {
    const text = 'Just a normal message';
    const lookupFn = async () => undefined;
    const result = await resolveUserMentions(text, lookupFn);
    expect(result).toBe('Just a normal message');
  });

  it('should handle channel and here mentions', async () => {
    const text = 'Hey <!channel> and <!here> check this out';
    const lookupFn = async () => undefined;
    const result = await resolveUserMentions(text, lookupFn);
    expect(result).toBe('Hey @channel and @here check this out');
  });

  it('should handle mentions with display name suffix', async () => {
    const text = 'Hey <@U123ABC|steve> how are you?';
    const lookupFn = async () => 'steve';
    const result = await resolveUserMentions(text, lookupFn);
    expect(result).toBe('Hey @steve how are you?');
  });
});

describe('truncateToTokenBudget', () => {
  const makeMsg = (name: string, message: string, minutesAgo: number): MessageWithName =>
    ({
      name,
      message,
      createdAt: new Date(Date.now() - minutesAgo * 60000),
    }) as MessageWithName;

  it('should return all messages when under budget', () => {
    const messages = [makeMsg('alice', 'hello', 5), makeMsg('bob', 'hi there', 4)];
    const result = truncateToTokenBudget(messages, 1000);
    expect(result).toHaveLength(2);
  });

  it('should drop oldest messages when over budget', () => {
    const messages = [
      makeMsg('alice', 'a'.repeat(2000), 10), // ~500 tokens, oldest
      makeMsg('bob', 'b'.repeat(2000), 5), // ~500 tokens
      makeMsg('carol', 'c'.repeat(200), 1), // ~50 tokens, newest
    ];
    const result = truncateToTokenBudget(messages, 600);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('bob');
    expect(result[1].name).toBe('carol');
  });

  it('should return empty array when no messages fit', () => {
    const messages = [makeMsg('alice', 'a'.repeat(8000), 1)];
    const result = truncateToTokenBudget(messages, 10);
    expect(result).toHaveLength(0);
  });

  it('should handle empty input', () => {
    const result = truncateToTokenBudget([], 1000);
    expect(result).toHaveLength(0);
  });
});
