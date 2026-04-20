export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'allTime';

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
  total: number;
}

export interface SearchFiltersResponse {
  users: string[];
  channels: string[];
}

export type SortKey = 'name' | 'channel' | 'message' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

export interface ActivityDataPoint {
  date: string;
  count: number;
}

export interface ChannelDataPoint {
  channel: string;
  count: number;
}

export interface SentimentDataPoint {
  weekStart: string;
  avgSentiment: number;
}

export interface LeaderboardEntry {
  name: string;
  count: number;
}

export interface RepLeaderboardEntry {
  name: string;
  rep: number;
}

export interface DashboardMyStats {
  totalMessages: number;
  rep: number;
  avgSentiment: number | null;
}

export interface DashboardResponse {
  myStats: DashboardMyStats;
  myActivity: ActivityDataPoint[];
  myTopChannels: ChannelDataPoint[];
  mySentimentTrend: SentimentDataPoint[];
  leaderboard: LeaderboardEntry[];
  repLeaderboard: RepLeaderboardEntry[];
}

export interface PersonalContextEntry {
  id: number;
  content: string;
  updatedAt: string;
}

export interface PersonalContextResponse {
  memories: PersonalContextEntry[];
  traits: PersonalContextEntry[];
}
