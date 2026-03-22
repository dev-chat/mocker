import { getRepository } from 'typeorm';
import type { MemoryWithSlackId } from '../../shared/db/models/Memory';
import { Memory } from '../../shared/db/models/Memory';
import { SlackUser } from '../../shared/db/models/SlackUser';
import { logError } from '../../shared/logger/error-logging';
import { logger } from '../../shared/logger/logger';

export class MemoryPersistenceService {
  private logger = logger.child({ module: 'MemoryPersistenceService' });

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
        logError(this.logger, 'Error saving memories', e, {
          slackId,
          teamId,
          memoryCount: contents.length,
        });
        return [];
      });
  }

  async getAllMemoriesForUser(slackId: string, teamId: string): Promise<MemoryWithSlackId[]> {
    return getRepository(Memory)
      .query(
        `SELECT m.*, u.slackId FROM memory m
         INNER JOIN slack_user u ON m.userIdId = u.id
         WHERE u.slackId = ? AND u.teamId = ?
         ORDER BY m.updatedAt DESC`,
        [slackId, teamId],
      )
      .catch((e) => {
        logError(this.logger, 'Error fetching all memories for user', e, {
          slackId,
          teamId,
        });
        return [];
      });
  }

  async getAllMemoriesForUsers(slackIds: string[], teamId: string): Promise<Map<string, MemoryWithSlackId[]>> {
    const result = new Map<string, MemoryWithSlackId[]>();

    const queries = slackIds.map(async (slackId) => {
      const memories = await this.getAllMemoriesForUser(slackId, teamId);
      if (memories.length) {
        result.set(slackId, memories);
      }
    });

    await Promise.all(queries);
    return result;
  }

  async reinforceMemory(memoryId: number): Promise<boolean> {
    return getRepository(Memory)
      .query('UPDATE memory SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [memoryId])
      .then(() => true)
      .catch((e) => {
        logError(this.logger, 'Error reinforcing memory', e, { memoryId });
        return false;
      });
  }

  async deleteMemory(memoryId: number): Promise<boolean> {
    return getRepository(Memory)
      .delete({ id: memoryId })
      .then((result) => (result.affected ?? 0) > 0)
      .catch((e) => {
        logError(this.logger, 'Error deleting memory', e, { memoryId });
        return false;
      });
  }
}
