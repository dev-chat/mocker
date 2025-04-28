import { WebService } from '../shared/services/web/web.service';
import { SuppressorService } from '../shared/services/suppressor.service';
import { StoreService } from './store.service';

interface ItemDefinition {
  id: number;
  interaction: (userId: string, teamId: string, usedOnUser: string, channel?: string) => Promise<string>;
}

export class ItemService {
  webService = WebService.getInstance();
  suppressorService = new SuppressorService();
  storeService = new StoreService();

  items: ItemDefinition[] = [
    {
      id: 1,
      interaction: (userId, teamId, usedOnUser): Promise<string> => {
        return this.storeService.useItem('1', userId, teamId, usedOnUser).catch((e) => {
          console.error(e);
          throw new Error(`Sorry, unable to set 50 Cal at this time. Please try again later.`);
        });
      },
    },
    {
      id: 2,
      interaction: (userId, teamId, usedOnUser): Promise<string> => {
        return this.storeService.useItem('2', userId, teamId, usedOnUser).catch((e) => {
          console.error(e);
          throw new Error(
            `Sorry, unable to set Guardian Angel on <@${usedOnUser}> at this time. Please try again later.`,
          );
        });
      },
    },
    {
      id: 3,
      interaction: async (userId, teamId, usedOnUser, channel): Promise<string> => {
        const isUserMuzzled = await this.suppressorService.isSuppressed(usedOnUser, teamId);
        if (isUserMuzzled) {
          await this.suppressorService.removeSuppression(usedOnUser, teamId);
          await this.webService
            .sendMessage(channel as string, `:zombie: <@${usedOnUser}> has been resurrected by <@${userId}>! :zombie:`)
            .catch((e) => {
              console.error(e);
              throw new Error(`Unable to resurrect <@${usedOnUser}>. Please try again.`);
            });
          return this.storeService.useItem('3', userId, teamId, usedOnUser);
        } else {
          throw new Error('Sorry, the user you are trying to resurrect is not currently dead.');
        }
      },
    },
    {
      id: 4,
      interaction: async (userId, teamId, usedOnUser): Promise<string> => {
        const isActive = await this.storeService.isItemActive(userId, teamId, 4);
        if (isActive) {
          throw new Error(`Sorry, unable to purchase Moon Token at this time. You already have one active.`);
        }
        return this.storeService.useItem('4', userId, teamId, usedOnUser).catch((e) => {
          console.error(e);
          throw new Error(`Sorry, unable to purchase Moon Token at this time. Please try again later.`);
        });
      },
    },
  ];

  async useItem(itemId: string, userId: string, teamId: string, userIdForItem: string, channel: string) {
    return await this.items.find((item) => item.id === +itemId)?.interaction(userId, teamId, userIdForItem, channel);
  }
}
