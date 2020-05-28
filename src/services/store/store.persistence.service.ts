import { getRepository } from 'typeorm';
import { Item } from '../../shared/db/models/Item';
import { InventoryItem } from '../../shared/db/models/InventoryItem';
import { User } from '../../shared/db/models/User';

export class StorePersistenceService {
  public static getInstance(): StorePersistenceService {
    if (!StorePersistenceService.instance) {
      StorePersistenceService.instance = new StorePersistenceService();
    }
    return StorePersistenceService.instance;
  }

  private static instance: StorePersistenceService;

  getItems(): Promise<Item[]> {
    return getRepository(Item).find();
  }

  getItem(itemId: number): Promise<Item> {
    return getRepository(Item).findOneOrFail({ id: itemId });
  }

  async buyItem(itemId: number, userId: string): Promise<string> {
    const itemById = await getRepository(Item).findOne(itemId);
    const userById = await getRepository(User).findOne({ slackId: userId });
    if (itemById && userById) {
      const item = new InventoryItem();
      item.item = itemById;
      item.owner = userById;
      return await getRepository(InventoryItem)
        .insert(item)
        .then(_result => `Congratulations! You have purchased ${itemById.name}`)
        .catch(e => {
          console.error(e);
          return `Sorry, unable to buy ${itemById.name}. Please try again later.`;
        });
    }
    return `Sorry, unable to buy your item at this time. Please try again later.`;
  }

  isOwnedByUser(itemId: number, userId: string): Promise<boolean> {
    // Should use the iuser x items table.
  }

  useItem(itemId: number, userId: string): Promise<string> {
    // Should use the user x items tables.
  }

  getInventory(userId: string): Promise<string> {
    // Should use the user x items table.
  }
}
