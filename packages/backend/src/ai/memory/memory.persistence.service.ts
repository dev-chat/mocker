import { getRepository } from 'typeorm';
import { Memory } from '../../shared/db/models/Memory';
import { SlackUser } from '../../shared/db/models/SlackUser';
import { logger } from '../../shared/logger/logger';

const MAX_MEMORIES_PER_USER = 10;

export class MemoryPersistenceService {
  private logger = logger.child({ module: 'MemoryPersistenceService' });

  async getMemoriesForUser(slackId: string, teamId: string): Promise<Memory[]> {
    const user = await getRepository(SlackUser).findOne({ where: { slackId, teamId } });
    if (!user) {
      return [];
    }

    return getRepository(Memory).find({
      where: { userId: user, teamId },
      order: { updatedAt: 'DESC' },
      take: MAX_MEMORIES_PER_USER,
    });
  }

  async getMemoriesForUsers(slackIds: string[], teamId: string): Promise<Map<string, Memory[]>> {
    const result = new Map<string, Memory[]>();

    if (!slackIds.length) {
      return result;
    }

    const memories = await getRepository(Memory)
      .createQueryBuilder('memory')
      .leftJoinAndSelect('memory.userId', 'user')
      .where('user.teamId = :teamId', { teamId })
      .andWhere('user.slackId IN (:...slackIds)', { slackIds })
      .orderBy('memory.updatedAt', 'DESC')
      .getMany();

    for (const memory of memories) {
      const slackId = (memory.userId as SlackUser).slackId;
      const existing = result.get(slackId) || [];
      if (existing.length < MAX_MEMORIES_PER_USER) {
        existing.push(memory);
        result.set(slackId, existing);
      }
    }

    return result;
  }

  async saveMemory(slackId: string, teamId: string, content: string, source = 'extracted'): Promise<Memory | null> {
    const user = await getRepository(SlackUser).findOne({ where: { slackId, teamId } });
    if (!user) {
      this.logger.warn(`Cannot save memory: user ${slackId} not found in team ${teamId}`);
      return null;
    }

    const memory = new Memory();
    memory.userId = user;
    memory.teamId = teamId;
    memory.content = content;
    memory.source = source;

    return getRepository(Memory)
      .save(memory)
      .catch((e) => {
        this.logger.error('Error saving memory:', e);
        return null;
      });
  }

  async saveMemories(slackId: string, teamId: string, contents: string[], source = 'extracted'): Promise<Memory[]> {
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
      memory.source = source;
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

  async getMemoryCount(slackId: string, teamId: string): Promise<number> {
    const user = await getRepository(SlackUser).findOne({ where: { slackId, teamId } });
    if (!user) {
      return 0;
    }

    return getRepository(Memory).count({ where: { userId: user, teamId } });
  }
}
