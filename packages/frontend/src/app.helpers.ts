import type { Message, SortKey, SortDirection } from '@/app.model';

function compareMessages(a: Message, b: Message, sortKey: SortKey): number {
  if (sortKey === 'createdAt') {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  }
  if (sortKey === 'name') {
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  }
  if (sortKey === 'channel') {
    const aChannel = a.channelName ?? a.channel;
    const bChannel = b.channelName ?? b.channel;
    return aChannel.localeCompare(bChannel, undefined, { sensitivity: 'base' });
  }
  return a.message.localeCompare(b.message, undefined, { sensitivity: 'base' });
}

export function getDisplayedMessages(
  messages: Message[],
  tableFilter: string,
  sortKey: SortKey,
  sortDirection: SortDirection,
): Message[] {
  const normalizedFilter = tableFilter.trim().toLowerCase();
  const filtered = normalizedFilter
    ? messages.filter((message) => {
        const channelText = (message.channelName ?? message.channel ?? '').toLowerCase();
        return (
          message.name.toLowerCase().includes(normalizedFilter) ||
          channelText.includes(normalizedFilter) ||
          message.message.toLowerCase().includes(normalizedFilter)
        );
      })
    : messages;

  return [...filtered].sort((a, b) => {
    const comparison = compareMessages(a, b, sortKey);
    return sortDirection === 'asc' ? comparison : -comparison;
  });
}
