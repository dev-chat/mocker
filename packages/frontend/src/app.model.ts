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

export type FrontendRecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface FrontendRecurrenceRule {
  frequency: FrontendRecurrenceFrequency;
  interval: number;
  until?: string;
}

export interface CalendarEventSeries {
  id: string;
  teamId: string;
  createdByUserId: string;
  title: string;
  location: string | null;
  isAllDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  recurrence: FrontendRecurrenceRule | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventOccurrence {
  occurrenceId: string;
  seriesId: string;
  title: string;
  location: string | null;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  isRecurring: boolean;
}

export interface CalendarEventsResponse {
  series: CalendarEventSeries[];
  occurrences: CalendarEventOccurrence[];
}

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
}

export interface FantasyLeague {
  league_id: string;
  name: string;
  season: string;
  status: string;
  avatar: string | null;
  total_rosters: number;
}

export interface FantasyLandingResponse {
  sleeperUser: SleeperUser | null;
  leagues: FantasyLeague[];
  season: string;
}

export interface FantasyPlayer {
  id: string;
  name: string;
  position: string | null;
  team: string | null;
  injuryStatus: string | null;
}

export interface PendingTrade {
  transactionId: string;
  createdAt: string;
  sides: Array<{
    rosterId: number;
    ownerName: string;
    players: FantasyPlayer[];
    draftPicks: string[];
  }>;
  insight: string;
  recommendation: 'accept' | 'decline' | 'negotiate';
}

export interface GameToWatch {
  id: string;
  startsAt: string;
  status: string;
  broadcast: string | null;
  awayTeam: string;
  homeTeam: string;
  rosterPlayers: FantasyPlayer[];
}

export interface TradeSuggestion {
  targetRosterId: number;
  targetOwnerName: string;
  give: FantasyPlayer[];
  receive: FantasyPlayer[];
  rationale: string;
  sleeperUrl: string;
}

export interface WaiverSuggestion {
  add: FantasyPlayer;
  drop: FantasyPlayer;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  sleeperUrl: string;
}

export interface FantasyOverview {
  league: FantasyLeague;
  roster: {
    rosterId: number;
    ownerName: string;
    players: FantasyPlayer[];
    starters: string[];
  };
  pendingTrades: PendingTrade[];
  gamesToWatch: GameToWatch[];
  tradeSuggestions: TradeSuggestion[];
  waiverSuggestions: WaiverSuggestion[];
  aiStatus: 'ready' | 'unavailable';
  sleeperUrl: string;
}
