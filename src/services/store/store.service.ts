import { ReactionPersistenceService } from '../reaction/reaction.persistence.service';

export class StoreService {
  storePersistenceService = StorePersistenceService.getInstance();
  reactionPersistenceService = ReactionPersistenceService.getInstance();

  listItems(): string {
    this.storePersistenceService.getItems();
    return '';
  }

  async isValidItem(itemId: string): Promise<boolean> {
    const id = +itemId;
    const isItem = this.storePersistenceService.getItem(id);
    return !!isItem;
  }

  async canAfford(itemId: string, userId: string): Promise<boolean> {
    const id = +itemId;
    const price: number = await this.storePersistenceService.getPrice(itemId);
    const userRep: number = await this.reactionPersistenceService.getRep(userId);
    return price <= userRep;
  }

  async buyItem(itemId: string, userId: string): Promise<string> {
    const id = +itemId;
    const receipt: string = await this.storePersistenceService.buyItem(id, userId);
    return receipt;
  }

  async isOwnedByUser(itemId: string, userId: string): Promise<boolean> {
    const id = +itemId;
    const isOwned = await this.storePersistenceService.isOwnedByUser(id, userId);
    return isOwned;
  }

  async useItem(itemId: string, userId: string): Promise<string> {
    const id = +itemId;
    const useItem = await this.storePersistenceService.useItem(id, userId);
    return useItem;
  }

  async getInventory(userId: string): Promise<string> {
    const inventory = await this.storePersistenceService.getInventory(userId);
    return inventory;
  }
}
