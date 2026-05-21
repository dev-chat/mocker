import { getRepository } from 'typeorm';
import { ArgumentLeaderboard } from '../shared/db/models/ArgumentLeaderboard';
import type { ArgumentParticipant } from '../shared/db/models/ArgumentLeaderboard';
import type { ArgumentParticipantViewpoints } from '../shared/db/models/ArgumentLeaderboard';
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

const buildParticipantViewpoints = (participants: ArgumentParticipant[]): ArgumentParticipantViewpoints =>
  Object.fromEntries(participants.map((participant) => [participant.slackId, participant.viewpoint]));

const buildArgumentParticipants = (
  participants: SlackUser[] | undefined,
  participantViewpoints: ArgumentParticipantViewpoints | null | undefined,
): ArgumentParticipant[] => {
  if (!participants || participants.length === 0 || !participantViewpoints) {
    return [];
  }

  const participantUserBySlackId = new Map(participants.map((participant) => [participant.slackId, participant]));

  return Object.entries(participantViewpoints)
    .flatMap(([slackId, viewpoint]) => {
      const participant = participantUserBySlackId.get(slackId);
      const normalizedViewpoint = viewpoint.trim();
      if (!participant || !normalizedViewpoint) {
        return [];
      }

      return [
        {
          slackId: participant.slackId,
          name: participant.name,
          viewpoint: normalizedViewpoint,
        },
      ];
    })
    .filter((participant) => participant.name.trim());
};

export class ArgumentPersistenceService {
  private logger = logger.child({ module: 'ArgumentPersistenceService' });

  async saveArgumentOutcome(input: SaveArgumentOutcomeInput): Promise<ArgumentOutcomeEntry | null> {
    const slackUserRepo = getRepository(SlackUser);
    const winner = await slackUserRepo.findOne({
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

    const participantUsers = await slackUserRepo.find({
      where: participants.map((participant) => ({ slackId: participant.slackId, teamId: input.teamId })),
    });
    const participantViewpoints = buildParticipantViewpoints(participants);
    const hydratedParticipants = buildArgumentParticipants(participantUsers, participantViewpoints);

    if (hydratedParticipants.length < 2) {
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
    entry.participants = participantUsers;
    entry.participantViewpoints = participantViewpoints;
    entry.winner = winner;
    entry.pointValue = clampPointValue(input.pointValue);

    return getRepository(ArgumentLeaderboard)
      .save(entry)
      .then((saved) => ({
        id: saved.id,
        argument: saved.argumentSummary,
        participants: buildArgumentParticipants(participantUsers, participantViewpoints),
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
        repo.find({
          where: { teamId },
          relations: ['participants', 'winner'],
          order: { createdAt: 'DESC' },
        }),
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
          participants: buildArgumentParticipants(row.participants, row.participantViewpoints),
          winner: {
            name: row.winner.name,
            slackId: row.winner.slackId,
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
