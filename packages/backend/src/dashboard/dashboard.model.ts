export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'allTime';

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

export interface MyStats {
  totalMessages: number;
  rep: number;
  avgSentiment: number | null;
}

export interface DashboardResponse {
  myStats: MyStats;
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
