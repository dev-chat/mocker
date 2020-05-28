import { ReactionPersistenceService } from '../reaction/reaction.persistence.service';
import { StorePersistenceService } from './store.persistence.service';
import { Item } from '../../shared/db/models/Item';

export class StoreService {
  storePersistenceService = StorePersistenceService.getInstance();
  reactionPersistenceService = ReactionPersistenceService.getInstance();

  async listItems(): Promise<string> {
    const items: Item[] = await this.storePersistenceService.getItems();
    return `${items}`; // This should format the items;
  }

  async isValidItem(itemId: string): Promise<boolean> {
    const id = +itemId;
    const isItem = await this.storePersistenceService.getItem(id);
    return !!isItem;
  }

  async canAfford(itemId: string, userId: string): Promise<boolean> {
    const id = +itemId;
    const price: number = (await this.storePersistenceService.getItem(id)).price;
    const userRep: number = await this.reactionPersistenceService.getRep(userId);
    return price <= userRep;
  }

  async buyItem(itemId: string, userId: string): Promise<string> {
    const id = +itemId;
    return await this.storePersistenceService.buyItem(id, userId);
  }

  async isOwnedByUser(itemId: string, userId: string): Promise<boolean> {
    const id = +itemId;
    const isOwned = await this.storePersistenceService.isOwnedByUser(id, userId);
    return isOwned;
  }

  async useItem(itemId: string, userId: string): Promise<void> {
    const id = +itemId;
    await this.storePersistenceService.useItem(id, userId);
  }

  async getInventory(userId: string): Promise<string> {
    const inventory = await this.storePersistenceService.getInventory(userId);
    return inventory.toString();
  }
}
