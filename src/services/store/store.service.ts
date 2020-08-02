import { ReactionPersistenceService } from '../reaction/reaction.persistence.service';
import { StorePersistenceService } from './store.persistence.service';
import { Item } from '../../shared/db/models/Item';

export class StoreService {
  storePersistenceService = StorePersistenceService.getInstance();
  reactionPersistenceService = ReactionPersistenceService.getInstance();

  async listItems(): Promise<string> {
    const items: Item[] = await this.storePersistenceService.getItems();
    let view =
      'Welcome to the Muzzle Store! Purchase items by typing `/buy item_id` where item_id is the number shown below! \n \n';
    items.map(item => {
      view += `*${item.id}. ${item.name}* \n *Cost:* ${item.price} rep \n *Description:* ${item.description} \n \n`;
    });
    return view;
  }

  public formatItems(items: Item[]): any {
    return items.map(item => {
      return {
        name: item.name,
        description: item.description,
        price: item.price,
      };
    });
  }

  async isValidItem(itemId: string): Promise<boolean> {
    const id = +itemId;
    const isItem = await this.storePersistenceService.getItem(id);
    return !!isItem;
  }

  async canAfford(itemId: string, userId: string, teamId: string): Promise<boolean> {
    const id = +itemId;
    const price: number = (await this.storePersistenceService.getItem(id)).price;
    const userRep: number | undefined = await this.reactionPersistenceService.getUserRep(userId, teamId);
    return userRep && price ? price <= userRep : false;
  }

  async buyItem(itemId: string, userId: string, teamId: string): Promise<string> {
    const id = +itemId;
    return await this.storePersistenceService.buyItem(id, userId, teamId);
  }

  async isOwnedByUser(itemId: string, userId: string, teamId: string): Promise<boolean> {
    const id = +itemId;
    const isOwned = await this.storePersistenceService.isOwnedByUser(id, userId, teamId);
    return isOwned;
  }

  async useItem(itemId: string, userId: string, teamId: string): Promise<void> {
    const id = +itemId;
    await this.storePersistenceService.useItem(id, userId, teamId);
  }

  async getInventory(userId: string, teamId: string): Promise<string> {
    const inventory = await this.storePersistenceService.getInventory(userId, teamId);
    return inventory.toString();
  }
}
