import { ReactionPersistenceService } from '../reaction/reaction.persistence.service';
import { StorePersistenceService } from './store.persistence.service';

export class StoreService {
  storePersistenceService = StorePersistenceService.getInstance();
  reactionPersistenceService = ReactionPersistenceService.getInstance();

  async listItems(slackId: string, teamId: string): Promise<string> {
    const items = await this.storePersistenceService.getItems(teamId);
    const rep = await this.reactionPersistenceService.getUserRep(slackId, teamId);
    let view = `Welcome to the Muzzle Store! \n \n Purchase items by typing \`/buy item_id\` where item_id is the number shown below! \n \n Once purchased, you can use items by typing \`/use item_id\` or you can view them in your inventory by typing \`/inventory\``;
    items.map(item => {
      view += `*${item.id}. ${item.name}* \n *Cost:* ${item.price} rep \n *Description:* ${item.description} \n \n`;
    });

    view += `You currently have *${rep ? rep : 0} Rep* to spend. Spend it wisely!`;
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
    const isItem = await this.storePersistenceService.getItem(id, teamId);
    return !!isItem;
  }

  async canAfford(itemId: string, userId: string, teamId: string): Promise<boolean> {
    const id = +itemId;
    const price: number | undefined = (await this.storePersistenceService.getItem(id, teamId))?.price;
    const userRep: number | undefined = await this.reactionPersistenceService.getUserRep(userId, teamId);
    return userRep && price ? price <= userRep : false;
  }

  async buyItem(itemId: string, userId: string, teamId: string): Promise<string> {
    const id = +itemId;
    return await this.storePersistenceService.buyItem(id, userId, teamId);
  }

  async isOwnedByUser(itemId: string | undefined, userId: string, teamId: string): Promise<boolean> {
    if (itemId) {
      const id = +itemId;
      return await this.storePersistenceService.isOwnedByUser(id, userId, teamId);
    }
    return false;
  }

  async useItem(itemId: string, userId: string, teamId: string, userIdForItem?: string): Promise<string> {
    const id = +itemId;
    return await this.storePersistenceService.useItem(id, userId, teamId, userIdForItem);
  }

  async getInventory(userId: string, teamId: string): Promise<string> {
    const inventory = await this.storePersistenceService.getInventory(userId, teamId);
    const rep = await this.reactionPersistenceService.getUserRep(userId, teamId);
    let view = '*Inventory* \n Use items by typing `/use item_id` where item_id is the number shown below. \n \n';
    inventory.map(inventory => {
      view += `*${inventory.name}* \n *Description:* ${inventory.description} \n \n`;
    });
    view += `Rep: ${rep ? rep : 0}`;
    return view;
  }
}
