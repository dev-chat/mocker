import type { ArgumentParticipant } from '../shared/db/models/ArgumentLeaderboard';

export interface ArgumentLeaderboardStanding {
  name: string;
  slackId: string;
  wins: number;
  points: number;
}

export interface ArgumentOutcomeWinner {
  name: string;
  slackId: string;
}

export interface ArgumentOutcomeEntry {
  id: number;
  argument: string;
  participants: ArgumentParticipant[];
  winner: ArgumentOutcomeWinner;
  pointValue: number;
  createdAt: string;
}

export interface ArgumentLeaderboardResponse {
  leaderboard: ArgumentLeaderboardStanding[];
  arguments: ArgumentOutcomeEntry[];
}

export interface SaveArgumentOutcomeInput {
  teamId: string;
  channelId: string;
  argumentSummary: string;
  participants: ArgumentParticipant[];
  winnerSlackId: string;
  pointValue: number;
}
