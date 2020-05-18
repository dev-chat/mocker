import { getRepository } from 'typeorm';
import { Item } from '../../shared/db/models/Item';

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

  buyItem(itemId: number): Promise<boolean> {
    // Should use the user x items table.
  }

  isOwnedByUser(itemId: number, userId: string): Promise<boolean> {
    // Should use the iuser x items table.
  }

  useItem(itemId: number, userId: string): Promise<boolean> {
    // Should use the user x items tables.
  }

  getInventory(userId: string): Promise<string> {
    // Should use the user x items table.
  }
}
