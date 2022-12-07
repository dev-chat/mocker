import { ReactionPersistenceService } from '../reaction/reaction.persistence.service';
import { StorePersistenceService } from './store.persistence.service';

export class StoreService {
  storePersistenceService = StorePersistenceService.getInstance();
  reactionPersistenceService = ReactionPersistenceService.getInstance();

  async listItems(slackId: string, teamId: string): Promise<string> {
    const items = await this.storePersistenceService.getItems(teamId);
    const { totalRepAvailable } = await this.reactionPersistenceService.getTotalRep(slackId, teamId);
    let view = `Welcome to the Muzzle Store! \n \n Purchase items by typing \`/buy item_id\` where item_id is the number shown below! \n \n Once purchased, the item will be immediately used. \n \n`;
    items.map(item => {
      view += `*${item.id}. ${item.name}* \n *Cost:* ${item.price} rep \n *Description:* ${
        item.description
      } \n *How to Use:* ${item.requiresUser ? `\`/buy ${item.id} @user\`` : `\`/buy ${item.id}\``} \n \n`;
    });

    view += `You currently have *${totalRepAvailable} Rep* to spend. Spend it wisely!`;
    return view;
  }

  public formatItems(items: any[]): any {
    return items.map(item => {
      return {
        name: item.name,
        description: item.description,
        price: item.price,
      };
    });
  }

  async isValidItem(itemId: string, teamId: string): Promise<boolean> {
    const id = +itemId;
    if (isNaN(id) || !Number.isFinite(id)) {
      return false;
    } else {
      const isItem = await this.storePersistenceService.getItem(id, teamId);
      return !!isItem;
    }
  }

  async canAfford(itemId: string, userId: string, teamId: string): Promise<boolean> {
    const id = +itemId;
    const price: number | undefined = (await this.storePersistenceService.getItem(id, teamId))?.price;
    const { totalRepAvailable } = await this.reactionPersistenceService.getTotalRep(userId, teamId);
    return totalRepAvailable && price ? price <= totalRepAvailable : false;
  }

  buyItem(itemId: string, userId: string, teamId: string): Promise<string> {
    const id = +itemId;
    return this.storePersistenceService.buyItem(id, userId, teamId);
  }

  async isUserRequired(itemId: string | undefined): Promise<boolean> {
    if (itemId) {
      const id = +itemId;
      return await this.storePersistenceService.isUserRequired(id);
    }
    return false;
  }

  async useItem(itemId: string, userId: string, teamId: string, userIdForItem?: string): Promise<string> {
    const id = +itemId;
    if (isNaN(id)) {
      return `Sorry, ${itemId} is not a valid item.`;
    }
    return this.storePersistenceService.useItem(id, userId, teamId, userIdForItem);
  }

  isItemActive(userId: string, teamId: string, itemId: number): Promise<boolean> {
    return this.storePersistenceService.isItemActive(userId, teamId, itemId);
  }

  removeEffect(userId: string, teamId: string, itemId: number): Promise<number> {
    return this.storePersistenceService.removeKey(this.storePersistenceService.getRedisKeyName(userId, teamId, itemId));
  }
}
