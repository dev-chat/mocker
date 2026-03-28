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

export interface SearchFiltersResponse {
  users: string[];
  channels: string[];
}
