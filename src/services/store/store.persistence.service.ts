import { getRepository, getManager } from 'typeorm';
import { Item } from '../../shared/db/models/Item';
import { InventoryItem } from '../../shared/db/models/InventoryItem';
import { SlackUser } from '../../shared/db/models/SlackUser';

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

  async buyItem(itemId: number, userId: string, teamId: string): Promise<string> {
    const itemById = await getRepository(Item).findOne(itemId);
    const userById = await getRepository(SlackUser).findOne({ slackId: userId, teamId });
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

  async isOwnedByUser(itemId: number, userId: string, teamId: string): Promise<boolean> {
    const itemById = await getRepository(Item).findOne(itemId);
    const userById = await getRepository(SlackUser).findOne({ slackId: userId, teamId });
    return !!getRepository(InventoryItem).findOneOrFail({ owner: userById, item: itemById });
  }

  async useItem(itemId: number, userId: string, teamId: string): Promise<void> {
    const userById = await getRepository(SlackUser).findOne({ slackId: userId, teamId });
    const itemById = await getRepository(Item).findOne(itemId);
    const inventoryItem = await getRepository(InventoryItem).findOne({
      owner: userById,
      item: itemById,
    });

    if (inventoryItem) {
      await getRepository(InventoryItem)
        .remove(inventoryItem)
        .then(_D => {
          console.log(`${userById?.slackId} used ${itemById?.name}`);
          // Needs to execute the thing that the item does. THinking about storing that code here in an items constant that maps by item name in DB.
        })
        .catch(e =>
          console.error(`Error when trying to use item: ${userById?.slackId} tried to use ${itemById?.name} but ${e}`),
        );
    }
  }

  // This query sucks cuz you suck at sql.
  async getInventory(userId: string, teamId: string): Promise<Item[]> {
    const user = await getRepository(SlackUser).findOne({ slackId: userId, teamId });
    const query = `select inventory_item.itemId, item.name, item.description from inventory_item INNER JOIN item ON inventory_item.itemId=item.id WHERE inventory_item.ownerId=${user?.id};`;
    return getManager().query(query);
  }
}
