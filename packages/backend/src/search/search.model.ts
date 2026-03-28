import type { MessageWithName } from '../shared/models/message/message-with-name';

export interface MessageSearchParams {
  teamId: string;
  userName?: string;
  channel?: string;
  content?: string;
  limit?: number;
  offset?: number;
}

export interface SearchMessagesResponse {
  messages: MessageWithName[];
  mentions: Record<string, string>;
  total: number;
}
