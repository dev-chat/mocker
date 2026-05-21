import { getRepository } from 'typeorm';
import { ArgumentLeaderboard } from '../shared/db/models/ArgumentLeaderboard';
import type { ArgumentParticipant } from '../shared/db/models/ArgumentLeaderboard';
import { SlackUser } from '../shared/db/models/SlackUser';
import { logger } from '../shared/logger/logger';
import { logError } from '../shared/logger/error-logging';
import type { ArgumentLeaderboardResponse, ArgumentOutcomeEntry, SaveArgumentOutcomeInput } from './argument.model';

interface LeaderboardRow {
  name: string;
  slackId: string;
  wins: string;
  points: string;
}

interface ArgumentRow {
  id: number;
  argumentSummary: string;
  participants: string;
  winnerName: string;
  winnerSlackId: string;
  pointValue: string;
  createdAt: string | Date;
}

const clampPointValue = (value: number): number => Math.min(5, Math.max(0, Math.round(value)));

const normalizeParticipant = (participant: Partial<ArgumentParticipant>): ArgumentParticipant | null => {
  const slackId = participant.slackId?.trim();
  const name = participant.name?.trim();
  const viewpoint = participant.viewpoint?.trim();
  if (!slackId || !name || !viewpoint) {
    return null;
  }

  return { slackId, name, viewpoint };
};

const parseParticipants = (raw: string): ArgumentParticipant[] => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((participant) =>
        typeof participant === 'object' && participant !== null ? normalizeParticipant(participant) : null,
      )
      .filter((participant): participant is ArgumentParticipant => participant !== null);
  } catch {
    return [];
  }
};

export class ArgumentPersistenceService {
  private logger = logger.child({ module: 'ArgumentPersistenceService' });

  async saveArgumentOutcome(input: SaveArgumentOutcomeInput): Promise<ArgumentOutcomeEntry | null> {
    const winner = await getRepository(SlackUser).findOne({
      where: { slackId: input.winnerSlackId, teamId: input.teamId },
    });

    if (!winner) {
      this.logger.warn('Skipping argument outcome save because winner was not found', {
        teamId: input.teamId,
        winnerSlackId: input.winnerSlackId,
      });
      return null;
    }

    const participants = Array.from(
      new Map(
        input.participants
          .map(normalizeParticipant)
          .filter((participant): participant is ArgumentParticipant => participant !== null)
          .map((participant) => [participant.slackId, participant]),
      ).values(),
    );

    if (participants.length < 2) {
      this.logger.warn('Skipping argument outcome save because fewer than two participants were extracted', {
        teamId: input.teamId,
        channelId: input.channelId,
      });
      return null;
    }

    const argumentSummary = input.argumentSummary.trim();
    if (!argumentSummary) {
      this.logger.warn('Skipping argument outcome save because summary was empty', {
        teamId: input.teamId,
        channelId: input.channelId,
      });
      return null;
    }

    const entry = new ArgumentLeaderboard();
    entry.teamId = input.teamId;
    entry.channelId = input.channelId;
    entry.argumentSummary = argumentSummary;
    entry.participants = participants;
    entry.winner = winner;
    entry.pointValue = clampPointValue(input.pointValue);

    return getRepository(ArgumentLeaderboard)
      .save(entry)
      .then((saved) => ({
        id: saved.id,
        argument: saved.argumentSummary,
        participants: saved.participants,
        winner: {
          name: winner.name,
          slackId: winner.slackId,
        },
        pointValue: saved.pointValue,
        createdAt: saved.createdAt.toISOString(),
      }))
      .catch((error) => {
        logError(this.logger, 'Failed to save argument outcome', error, {
          teamId: input.teamId,
          channelId: input.channelId,
          winnerSlackId: input.winnerSlackId,
        });
        throw error;
      });
  }

  async getArgumentLeaderboard(teamId: string): Promise<ArgumentLeaderboardResponse> {
    const repo = getRepository(ArgumentLeaderboard);

    try {
      const [leaderboardRows, argumentRows] = await Promise.all([
        repo.query<LeaderboardRow[]>(
          `SELECT u.name AS name,
                  u.slackId AS slackId,
                  CAST(COUNT(*) AS SIGNED) AS wins,
                  CAST(COALESCE(SUM(a.pointValue), 0) AS SIGNED) AS points
           FROM argument_leaderboard a
           INNER JOIN slack_user u ON u.id = a.winnerId
           WHERE a.teamId = ?
           GROUP BY u.id, u.name, u.slackId
           ORDER BY wins DESC, points DESC, u.name ASC`,
          [teamId],
        ),
        repo.query<ArgumentRow[]>(
          `SELECT a.id AS id,
                  a.argumentSummary AS argumentSummary,
                  a.participants AS participants,
                  u.name AS winnerName,
                  u.slackId AS winnerSlackId,
                  CAST(a.pointValue AS SIGNED) AS pointValue,
                  a.createdAt AS createdAt
           FROM argument_leaderboard a
           INNER JOIN slack_user u ON u.id = a.winnerId
           WHERE a.teamId = ?
           ORDER BY a.createdAt DESC`,
          [teamId],
        ),
      ]);

      return {
        leaderboard: leaderboardRows.map((row) => ({
          name: row.name,
          slackId: row.slackId,
          wins: Number(row.wins),
          points: Number(row.points),
        })),
        arguments: argumentRows.map((row) => ({
          id: Number(row.id),
          argument: row.argumentSummary,
          participants: parseParticipants(row.participants),
          winner: {
            name: row.winnerName,
            slackId: row.winnerSlackId,
          },
          pointValue: Number(row.pointValue),
          createdAt: new Date(row.createdAt).toISOString(),
        })),
      };
    } catch (error) {
      logError(this.logger, 'Failed to load argument leaderboard', error, { teamId });
      throw error;
    }
  }
}
