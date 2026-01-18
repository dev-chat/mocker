export interface User {
  userId: string;
  teamId: string;
  userName: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface SlackUser {
  id: number;
  slackId: string;
  name: string;
}

export interface SlackChannel {
  id: number;
  channelId: string;
  name: string;
}

export interface MessageSearchResult {
  id: number;
  message: string;
  createdAt: string;
  teamId: string;
  channel: string;
  userName: string;
  userSlackId: string;
  channelName: string | null;
}

export interface SearchResults {
  messages: MessageSearchResult[];
  total: number;
  limit: number;
  offset: number;
}

export interface SearchParams {
  query?: string;
  userId?: string;
  channelId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ApiError {
  error: string;
}
