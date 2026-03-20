import express, { Router } from 'express';
import { MemoryPersistenceService } from '../ai/memory/memory.persistence.service';
import { WebService } from '../shared/services/web/web.service';
import { suppressedMiddleware } from '../shared/middleware/suppression';
import { logger } from '../shared/logger/logger';

export const memoryController: Router = express.Router();
memoryController.use(suppressedMiddleware);

const memoryPersistenceService = new MemoryPersistenceService();
const webService = new WebService();
const memoryLogger = logger.child({ module: 'MemoryController' });

memoryController.post('/', async (req, res) => {
  const { user_id, team_id, channel_id } = req.body;

  // Respond immediately — Slack requires a response within 3 seconds
  res.status(200).send('');

  try {
    const memories = await memoryPersistenceService.getAllMemoriesForUser(user_id, team_id);

    if (!memories?.length) {
      webService.sendEphemeral(
        channel_id,
        "Moonbeam doesn't remember anything about you yet.",
        user_id,
      );
      return;
    }

    const formattedMemories = memories
      .map((memory, index) => {
        const date = new Date(memory.updatedAt).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        });
        return `${index + 1}. "${memory.content}" (${date.toLowerCase()})`;
      })
      .join('\n');

    const message = `What Moonbeam remembers about you:\n${formattedMemories}`;
    webService.sendEphemeral(channel_id, message, user_id);
  } catch (e) {
    memoryLogger.error('Error fetching memories for /memory command:', e);
    webService.sendEphemeral(
      channel_id,
      'Sorry, something went wrong fetching your memories.',
      user_id,
    );
  }
});
