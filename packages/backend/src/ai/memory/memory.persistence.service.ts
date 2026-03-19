import { getRepository } from 'typeorm';
import { Memory } from '../../shared/db/models/Memory';
import { SlackUser } from '../../shared/db/models/SlackUser';
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
        this.logger.error('Error saving memories:', e);
        return [];
      });
  }

  async getAllMemoriesForUser(slackId: string, teamId: string): Promise<Memory[]> {
    return getRepository(Memory)
      .query(
        `SELECT m.*, u.slackId FROM memory m
         INNER JOIN slack_user u ON m.userIdId = u.id
         WHERE u.slackId = ? AND u.teamId = ?
         ORDER BY m.updatedAt DESC`,
        [slackId, teamId],
      )
      .catch((e) => {
        this.logger.error('Error fetching all memories for user:', e);
        return [];
      });
  }

  async getAllMemoriesForUsers(slackIds: string[], teamId: string): Promise<Map<string, Memory[]>> {
    const result = new Map<string, Memory[]>();

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
        this.logger.error('Error reinforcing memory:', e);
        return false;
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
