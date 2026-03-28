export interface Message {
  id: number;
  message: string;
  channel: string;
  channelName?: string;
  teamId: string;
  createdAt: string;
  name: string;
  slackId: string;
}

export interface SearchMessagesResponse {
  messages: Message[];
  mentions: Record<string, string>;
}

export interface SearchFiltersResponse {
  users: string[];
  channels: string[];
}

export type SortKey = 'name' | 'channel' | 'message' | 'createdAt';
export type SortDirection = 'asc' | 'desc';
