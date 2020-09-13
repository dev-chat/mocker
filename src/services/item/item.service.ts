import { WebService } from '../web/web.service';
import { SuppressorService } from '../../shared/services/suppressor.service';
import { StoreService } from '../store/store.service';

export class ItemService {
  webService = WebService.getInstance();
  suppressorService = new SuppressorService();
  storeService = new StoreService();

  items = [
    {
      id: 1,
      interaction: async (userId: string, teamId: string, usedOnUser: string, _channel: string): Promise<string> => {
        return await this.storeService.useItem('2', userId, teamId, usedOnUser);
      },
    },
    {
      id: 2,
      interaction: async (userId: string, teamId: string, usedOnUser: string, _channel: string): Promise<string> => {
        return await this.storeService.useItem('2', userId, teamId, usedOnUser);
      },
    },
    {
      id: 3,
      interaction: async (userId: string, teamId: string, usedOnUser: string, channel: string): Promise<string> => {
        const isUserMuzzled = await this.suppressorService.isSuppressed(usedOnUser, teamId);
        if (isUserMuzzled) {
          await this.suppressorService.removeSuppression(usedOnUser, teamId);
          await this.webService.sendMessage(
            channel,
            `:zombie: <@${usedOnUser}> has been resurrected by <@${userId}>! :zombie:`,
          );
          return await this.storeService.useItem('3', userId, teamId, usedOnUser);
        } else {
          return 'Sorry, the user you are trying to resurrect is not currently dead.';
        }
      },
    },
  ];

  async useItem(itemId: string, userId: string, teamId: string, userIdForItem: string, channel: string) {
    return await this.items.find(item => item.id === +itemId)?.interaction(userId, teamId, userIdForItem, channel);
  }
}
