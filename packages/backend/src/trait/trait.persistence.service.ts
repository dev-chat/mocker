import { getRepository } from 'typeorm';
import { logger } from '../shared/logger/logger';
import { SlackUser } from '../shared/db/models/SlackUser';
import { Trait, type TraitWithSlackId } from '../shared/db/models/Trait';
import { logError } from '../shared/logger/error-logging';

const MAX_TRAITS_PER_USER = 10;

export class TraitPersistenceService {
  private traitLogger = logger.child({ module: 'TraitPersistenceService' });

  async replaceTraitsForUser(slackId: string, teamId: string, contents: string[]): Promise<Trait[]> {
    const user = await getRepository(SlackUser).findOne({ where: { slackId, teamId } });
    if (!user) {
      this.traitLogger.warn(`Cannot save traits: user ${slackId} not found in team ${teamId}`);
      return [];
    }

    const normalizedContents = Array.from(
      new Set(contents.map((content) => content.trim()).filter((content) => content.length > 0)),
    ).slice(0, MAX_TRAITS_PER_USER);

    return getRepository(Trait)
      .query('DELETE FROM trait WHERE userIdId = ? AND teamId = ?', [user.id, teamId])
      .then(async () => {
        if (normalizedContents.length === 0) {
          return [];
        }

        const traits = normalizedContents.map((content) => {
          const trait = new Trait();
          trait.userId = user;
          trait.teamId = teamId;
          trait.content = content;
          return trait;
        });

        return getRepository(Trait).save(traits);
      })
      .catch((e) => {
        logError(this.traitLogger, 'Error replacing traits for user', e, {
          slackId,
          teamId,
          traitCount: normalizedContents.length,
        });
        return [];
      });
  }

  async getAllTraitsForUser(slackId: string, teamId: string): Promise<TraitWithSlackId[]> {
    return getRepository(Trait)
      .query(
        `SELECT t.*, u.slackId FROM trait t
         INNER JOIN slack_user u ON t.userIdId = u.id
         WHERE u.slackId = ? AND u.teamId = ?
         ORDER BY t.updatedAt DESC`,
        [slackId, teamId],
      )
      .catch((e) => {
        logError(this.traitLogger, 'Error fetching all traits for user', e, {
          slackId,
          teamId,
        });
        return [];
      });
  }

  async getAllTraitsForUsers(slackIds: string[], teamId: string): Promise<Map<string, TraitWithSlackId[]>> {
    const result = new Map<string, TraitWithSlackId[]>();
    const uniqueSlackIds = Array.from(new Set(slackIds));

    if (uniqueSlackIds.length === 0) {
      return result;
    }

    const placeholders = uniqueSlackIds.map(() => '?').join(', ');

    return getRepository(Trait)
      .query(
        `SELECT t.*, u.slackId FROM trait t
         INNER JOIN slack_user u ON t.userIdId = u.id
         WHERE u.teamId = ? AND u.slackId IN (${placeholders})
         ORDER BY t.updatedAt DESC`,
        [teamId, ...uniqueSlackIds],
      )
      .then((traits: TraitWithSlackId[]) => {
        traits.forEach((trait) => {
          const existingTraits = result.get(trait.slackId) ?? [];
          existingTraits.push(trait);
          result.set(trait.slackId, existingTraits);
        });

        return result;
      })
      .catch((e) => {
        logError(this.traitLogger, 'Error fetching all traits for users', e, {
          teamId,
          slackIdCount: uniqueSlackIds.length,
        });
        return result;
      });
  }
}
