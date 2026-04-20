import type { MessageWithName } from '../../shared/models/message/message-with-name';

export const extractParticipantSlackIds = (
  history: MessageWithName[],
  options?: { includeSlackId?: string; excludeSlackIds?: string[] },
): string[] => {
  const excludeSet = new Set(options?.excludeSlackIds || []);
  const ids = [
    ...new Set(history.filter((msg) => msg.slackId && !excludeSet.has(msg.slackId!)).map((msg) => msg.slackId!)),
  ];
  if (options?.includeSlackId && !ids.includes(options.includeSlackId)) {
    ids.push(options.includeSlackId);
  }
  return ids;
};
