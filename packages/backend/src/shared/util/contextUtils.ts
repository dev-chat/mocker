import { MessageWithName } from '../models/message/message-with-name';

/**
 * Resolves Slack user mention markup (<@USERID>) to display names (@username).
 * Also resolves <!channel> and <!here> to @channel and @here.
 */
export async function resolveUserMentions(
  text: string,
  lookupFn: (userId: string) => Promise<string | undefined>,
): Promise<string> {
  // Resolve <!channel> and <!here>
  let resolved = text.replace(/<!channel>/g, '@channel').replace(/<!here>/g, '@here');

  // Find all <@USERID> patterns (with optional |displayname suffix)
  const mentionRegex = /<@(\w+)(?:\|[^>]*)?>/g;
  const matches = [...resolved.matchAll(mentionRegex)];

  for (const match of matches) {
    const userId = match[1];
    const displayName = await lookupFn(userId);
    if (displayName) {
      resolved = resolved.replace(match[0], `@${displayName}`);
    }
  }

  return resolved;
}

/**
 * Estimates token count using chars/4 heuristic.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncates message history from the oldest end to fit within a token budget.
 * Messages are assumed to be in chronological order (oldest first).
 * Returns a new array — does not mutate the input.
 */
export function truncateToTokenBudget(messages: MessageWithName[], maxTokens: number): MessageWithName[] {
  const costs = messages.map((m) => estimateTokens(`${m.name}: ${m.message}`));
  const totalTokens = costs.reduce((sum, c) => sum + c, 0);

  if (totalTokens <= maxTokens) {
    return messages;
  }

  let remaining = totalTokens;
  let startIndex = 0;
  while (startIndex < messages.length && remaining > maxTokens) {
    remaining -= costs[startIndex];
    startIndex++;
  }

  return messages.slice(startIndex);
}
