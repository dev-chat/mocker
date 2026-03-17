import { getRepository } from 'typeorm';
import { Memory } from '../../shared/db/models/Memory';
import { SlackUser } from '../../shared/db/models/SlackUser';
import { logger } from '../../shared/logger/logger';

const MAX_MEMORIES_PER_USER = 10;

export class MemoryPersistenceService {
  private logger = logger.child({ module: 'MemoryPersistenceService' });

  async getMemoriesForUser(slackId: string, teamId: string): Promise<Memory[]> {
    return getRepository(Memory)
      .query(
        `SELECT m.* FROM memory m
         INNER JOIN slack_user u ON m.userIdId = u.id
         WHERE u.slackId = ? AND u.teamId = ?
         ORDER BY m.updatedAt DESC
         LIMIT ?`,
        [slackId, teamId, MAX_MEMORIES_PER_USER],
      )
      .catch((e) => {
        this.logger.error('Error fetching memories for user:', e);
        return [];
      });
  }

  /**
   * Fetches memories for multiple users by querying each individually.
   * Each query uses LIMIT to cap at MAX_MEMORIES_PER_USER so the DB
   * handles filtering rather than pulling everything into JS memory.
   * Fine for our scale — conversations have a handful of users at most.
   */
  async getMemoriesForUsers(slackIds: string[], teamId: string): Promise<Map<string, Memory[]>> {
    const result = new Map<string, Memory[]>();

    const queries = slackIds.map(async (slackId) => {
      const memories = await this.getMemoriesForUser(slackId, teamId);
      if (memories.length) {
        result.set(slackId, memories);
      }
    });

    await Promise.all(queries);
    return result;
  }

  async saveMemories(slackId: string, teamId: string, contents: string[]): Promise<Memory[]> {
    const user = await getRepository(SlackUser).findOne({ where: { slackId, teamId } });
    if (!user) {
      this.logger.warn(`Cannot save memories: user ${slackId} not found in team ${teamId}`);
      return [];
    }

    const memories = contents.map((content) => {
      const memory = new Memory();
      memory.userId = user;
      memory.teamId = teamId;
      memory.content = content;
      return memory;
    });

    return getRepository(Memory)
      .save(memories)
      .catch((e) => {
        this.logger.error('Error saving memories:', e);
        return [];
      });
  }

  async deleteMemory(memoryId: number): Promise<boolean> {
    return getRepository(Memory)
      .delete({ id: memoryId })
      .then((result) => (result.affected ?? 0) > 0)
      .catch((e) => {
        this.logger.error('Error deleting memory:', e);
        return false;
      });
  }
}
