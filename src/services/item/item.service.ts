import { StorePersistenceService } from '../store/store.persistence.service';
import { WebService } from '../web/web.service';
import { SuppressorService } from '../../shared/services/suppressor.service';

export class ItemService {
  storePersistenceService = StorePersistenceService.getInstance();
  webService = WebService.getInstance();
  suppressorService = new SuppressorService();

  items = [
    {
      id: 3,
      interaction: async (userId: string, teamId: string, channel: string): Promise<void> => {
        await this.suppressorService.removeSuppression(userId, teamId);
        await this.webService.sendMessage(channel, `:zombie: <@${userId}> has returned from the dead ... :zombie:`);
      },
    },
  ];

  useItem(itemId: number, userId: string, teamId: string, channel: string) {
    this.items.find(item => item.id === itemId)?.interaction(userId, teamId, channel);
  }
}
