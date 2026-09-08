export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  status: string;
  avatar: string | null;
  total_rosters: number;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
  starters: string[] | null;
  reserve?: string[] | null;
}

export interface SleeperLeagueUser {
  user_id: string;
  display_name: string;
  username: string;
  metadata?: { team_name?: string } | null;
}

export interface SleeperDraftPick {
  season: string;
  round: number;
  previous_owner_id: number;
  owner_id: number;
}

export interface SleeperTransaction {
  transaction_id: string;
  type: string;
  status: string;
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks?: SleeperDraftPick[] | null;
  created: number;
}

export interface SleeperPlayer {
  player_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  team: string | null;
  injury_status: string | null;
}

export interface FantasyPlayer {
  id: string;
  name: string;
  position: string | null;
  team: string | null;
  injuryStatus: string | null;
}

export interface FantasyTeam {
  rosterId: number;
  ownerName: string;
  players: FantasyPlayer[];
  starters: string[];
}

export interface TradeSide {
  rosterId: number;
  ownerName: string;
  players: FantasyPlayer[];
  draftPicks: string[];
}

export interface PendingTrade {
  transactionId: string;
  createdAt: string;
  sides: TradeSide[];
  insight: string;
  recommendation: 'accept' | 'decline' | 'negotiate';
}

export interface TradeSuggestion {
  targetRosterId: number;
  targetOwnerName: string;
  give: FantasyPlayer[];
  receive: FantasyPlayer[];
  rationale: string;
  sleeperUrl: string;
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

export interface FantasyOverview {
  league: SleeperLeague;
  roster: FantasyTeam;
  pendingTrades: PendingTrade[];
  gamesToWatch: GameToWatch[];
  tradeSuggestions: TradeSuggestion[];
  aiStatus: 'ready' | 'unavailable';
  sleeperUrl: string;
}

export interface FantasyLandingResponse {
  sleeperUser: SleeperUser | null;
  leagues: SleeperLeague[];
  season: string;
}

export interface AITradeAnalysis {
  tradeInsights: Array<{
    transactionId: string;
    insight: string;
    recommendation: 'accept' | 'decline' | 'negotiate';
  }>;
  suggestions: Array<{
    targetRosterId: number;
    givePlayerIds: string[];
    receivePlayerIds: string[];
    rationale: string;
  }>;
}
