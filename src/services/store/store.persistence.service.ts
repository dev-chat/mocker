import { getRepository, getManager } from 'typeorm';
import { Item } from '../../shared/db/models/Item';
import { InventoryItem } from '../../shared/db/models/InventoryItem';
import { SlackUser } from '../../shared/db/models/SlackUser';
import { ReactionPersistenceService } from '../reaction/reaction.persistence.service';
import { RedisPersistenceService } from '../../shared/services/redis.persistence.service';
import { getMsForSpecifiedRange } from '../muzzle/muzzle-utilities';

export class StorePersistenceService {
  public static getInstance(): StorePersistenceService {
    if (!StorePersistenceService.instance) {
      StorePersistenceService.instance = new StorePersistenceService();
    }
    return StorePersistenceService.instance;
  }

  private static instance: StorePersistenceService;
  private reactionPersistenceService: ReactionPersistenceService = ReactionPersistenceService.getInstance();
  private redisService: RedisPersistenceService = RedisPersistenceService.getInstance();

  getItems(): Promise<Item[]> {
    return getRepository(Item).find();
  }

  getItem(itemId: number): Promise<Item | undefined> {
    return getRepository(Item).findOne({ id: itemId });
  }

  // This function is not very scalable and will only work with 50 Cal Rounds for right now. It will need to be reworked
  async getTimeModifiers(userId: string, teamId: string) {
    let time = 0;
    const modifiers = [
      {
        name: '50CalRounds',
        time: 120000,
      },
    ];
    const items = await this.redisService.getPattern(`muzzle.item.${userId}-${teamId}.${modifiers[0].name}`);
    time += items.length * modifiers[0].time;
    return time;
  }

  // TODO: Fix this query.
  async buyItem(itemId: number, userId: string, teamId: string): Promise<string> {
    const itemById = await getRepository(Item).findOne(itemId);
    const userById = await getRepository(SlackUser).findOne({ slackId: userId, teamId });
    if (itemById && userById) {
      const item = new InventoryItem();
      item.item = itemById;
      item.owner = userById;
      await this.reactionPersistenceService.spendRep(userId, teamId, itemById.price);
      return await getRepository(InventoryItem)
        .insert(item)
        .then(_result => `Congratulations! You have purchased *_${itemById.name}!_*`)
        .catch(e => {
          console.error(e);
          return `Sorry, unable to buy ${itemById.name}. Please try again later.`;
        });
    }
    return `Sorry, unable to buy your item at this time. Please try again later.`;
  }

  // TODO: Fix this query.
  async isOwnedByUser(itemId: number, userId: string, teamId: string): Promise<boolean> {
    const itemById = await getRepository(Item).findOne(itemId);
    const userById = await getRepository(SlackUser).findOne({ slackId: userId, teamId });
    return await getRepository(InventoryItem)
      .findOne({ owner: userById, item: itemById })
      .then(result => {
        return !!result;
      });
  }

  // TODO: Fix this query.
  async useItem(itemId: number, userId: string, teamId: string): Promise<string> {
    const userById: SlackUser | undefined = await getRepository(SlackUser).findOne({ slackId: userId, teamId });
    const itemById: Item | undefined = await getRepository(Item).findOne(itemId);
    const inventoryItem = (await getRepository(InventoryItem).findOne({
      owner: userById,
      item: itemById,
    })) as InventoryItem;
    const nameWithoutSpaces = itemById?.name.split(' ').join('');
    const existingKey = await this.redisService.getPattern(`muzzle.item.${userId}-${teamId}.${nameWithoutSpaces}`);
    if (existingKey.length) {
      if (itemById?.isStackable) {
        this.redisService.setValueWithExpire(
          `muzzle.item.${userId}-${teamId}.${nameWithoutSpaces}.${existingKey.length}`,
          1,
          'PX',
          !itemById.isRange ? itemById.max_ms : getMsForSpecifiedRange(itemById.min_ms, itemById.max_ms),
        );
      } else if (!itemById?.isStackable) {
        return `Unable to use your item. This item is not stackable.`;
      }
    } else if (!existingKey.length && itemById) {
      this.redisService.setValueWithExpire(
        `muzzle.item.${userId}-${teamId}.${nameWithoutSpaces}`,
        1,
        'PX',
        !itemById.isRange ? itemById.max_ms : getMsForSpecifiedRange(itemById.min_ms, itemById.max_ms),
      );
    }

    const message = await getRepository(InventoryItem)
      .remove(inventoryItem)
      .then(_D => {
        console.log(`${userById?.slackId} used ${itemById?.name}`);
        return `${itemById?.name} used!`;
        // Needs to execute the thing that the item does. THinking about storing that code here in an items constant that maps by item name in DB.
      });
    return message;
  }

  async getInventory(userId: string, teamId: string): Promise<Item[]> {
    const query = `SELECT inventory_item.itemId, item.name, item.description FROM inventory_item INNER JOIN item ON inventory_item.itemId=item.id WHERE inventory_item.ownerId=(SELECT id FROM slack_user WHERE slackId='${userId}' AND teamId='${teamId}');`;
    return getManager().query(query);
  }
}
