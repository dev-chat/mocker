export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
}

export interface SleeperLeague {
  league_id: string;
  previous_league_id?: string | null;
  name: string;
  season: string;
  status: string;
  avatar: string | null;
  total_rosters: number;
  settings?: {
    waiver_budget?: number;
    /** Sleeper league format: 0 = redraft, 1 = keeper, 2 = dynasty. */
    type?: number;
  };
  roster_positions?: string[];
  scoring_settings?: Record<string, number>;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
  starters: string[] | null;
  reserve?: string[] | null;
  settings?: {
    waiver_budget_used?: number;
  };
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
  settings?: {
    waiver_bid?: number;
  };
  created: number;
}

export interface SleeperPlayer {
  player_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  team: string | null;
  injury_status: string | null;
  fantasy_positions?: string[] | null;
  search_rank?: number | null;
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number | null;
  players: string[] | null;
  starters: string[] | null;
}

export interface SleeperProjection {
  player_id: string;
  opponent?: string | null;
  stats?: Record<string, number | null | undefined>;
}

export interface WaiverBidGuidance {
  sampleSize: number;
  suggestedBids: Record<string, number>;
}

export interface FantasyPlayer {
  id: string;
  name: string;
  position: string | null;
  team: string | null;
  injuryStatus: string | null;
  fantasyPositions: string[];
  /** Consensus market value from FantasyCalc for the league's format (dynasty/redraft, QB count, PPR). Null if unranked. */
  marketValue: number | null;
  /** FantasyCalc rank among players at the same position. Null if unranked. */
  positionRank: number | null;
}

/** A single player valuation entry from the FantasyCalc `/values/current` API, keyed by Sleeper player ID. */
export interface FantasyCalcPlayerValue {
  sleeperId: string;
  value: number;
  overallRank: number;
  positionRank: number;
  trend30Day: number;
  tradeFrequency: number | null;
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

export interface WaiverSuggestion {
  add: FantasyPlayer;
  drop: FantasyPlayer;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  recommendedBid: number;
  sleeperUrl: string;
}

export interface PendingWaiver {
  transactionId: string;
  createdAt: string;
  add: FantasyPlayer | null;
  drop: FantasyPlayer | null;
  bid: number | null;
}

export interface TeamHealth {
  percentage: number;
  rating: 'good' | 'ok' | 'bad';
  summary: string;
}

export interface ProjectedFantasyPlayer extends FantasyPlayer {
  projectedPoints: number;
}

export interface LineupRecommendation {
  week: number;
  opponentOwnerName: string | null;
  recommendedStarters: ProjectedFantasyPlayer[];
  start: ProjectedFantasyPlayer[];
  sit: ProjectedFantasyPlayer[];
  userPotential: { min: number; max: number };
  opponentPotential: { min: number; max: number } | null;
  summary: string;
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
  pendingWaivers: PendingWaiver[];
  gamesToWatch: GameToWatch[];
  tradeSuggestions: TradeSuggestion[];
  waiverSuggestions: WaiverSuggestion[];
  lineupRecommendation: LineupRecommendation | null;
  lineupStatus: 'ready' | 'unavailable' | 'no_matchup';
  teamHealth: TeamHealth | null;
  aiStatus: 'ready' | 'unavailable';
  sleeperUrl: string;
}

export interface FantasyLandingResponse {
  sleeperUser: SleeperUser | null;
  leagues: SleeperLeague[];
  season: string;
}

export interface AITradeAnalysis {
  teamHealth: {
    percentage: number;
    summary: string;
  };
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
  waiverSuggestions: Array<{
    addPlayerId: string;
    dropPlayerId: string;
    rationale: string;
    priority: 'high' | 'medium' | 'low';
    recommendedBid: number;
  }>;
  lineupSummary: string;
}
