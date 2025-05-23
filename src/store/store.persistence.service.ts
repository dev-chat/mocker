import { getRepository, getManager } from 'typeorm';
import { Item } from '../shared/db/models/Item';
import { SlackUser } from '../shared/db/models/SlackUser';
import { RedisPersistenceService } from '../shared/services/redis.persistence.service';
import { Purchase } from '../shared/db/models/Purchase';
import { UsedItem } from '../shared/db/models/UsedItem';
import { ItemKill } from '../shared/db/models/ItemKill';
import { getMsForSpecifiedRange } from '../muzzle/muzzle-utilities';
import { logger } from '../shared/logger/logger';

interface ItemWithPrice extends Item {
  price: number;
}
export class StorePersistenceService {
  private redisService: RedisPersistenceService = RedisPersistenceService.getInstance();
  logger = logger.child({ module: 'StorePersistenceService' });

  async getItems(teamId: string): Promise<ItemWithPrice[]> {
    const items = await getRepository(Item).find();
    const itemsWithPrices = await Promise.all(
      items.map(async (item: Item) => {
        const price = await getManager().query(
          `SELECT * FROM price WHERE itemId=${item.id} AND teamId='${teamId}' AND createdAt=(SELECT MAX(createdAt) FROM price WHERE itemId=${item.id} AND teamId='${teamId}');`,
        );
        return { ...item, price: price[0]?.price };
      }),
    );
    return itemsWithPrices;
  }

  async getItem(itemId: number, teamId: string): Promise<ItemWithPrice | undefined> {
    if (isNaN(itemId)) {
      return undefined;
    } else {
      const item = await getRepository(Item).findOne({ where: { id: itemId } });
      const price = await getManager().query(
        `SELECT * FROM price WHERE itemId=${itemId} AND teamId='${teamId}' AND createdAt=(SELECT MAX(createdAt) FROM price WHERE itemId=${itemId} AND teamId='${teamId}');`,
      );
      // Gargbage
      const itemWithPrice = item ? { ...item, price: price[0].price } : undefined;
      return itemWithPrice;
    }
  }

  isItemActive(userId: string, teamId: string, itemId: number): Promise<boolean> {
    return this.redisService.getValue(this.getRedisKeyName(userId, teamId, itemId)).then((x) => !!x);
  }

  // Returns active OFFENSIVE items.
  async getActiveItems(userId: string, teamId: string): Promise<string[]> {
    const defensiveItems = await getRepository(Item).find({ where: { isDefensive: true } });
    return this.redisService.getPattern(this.getRedisKeyName(userId, teamId)).then((result) => {
      const items: string[] = result.map((item: string): string => {
        const itemArr = item.split('.');
        let isDefensive = false;
        for (const item of defensiveItems) {
          if (item.id === +itemArr[3]) {
            isDefensive = true;
          }
        }
        // Hardcoded because we can rely on this being the itemName per getRedisKeyName
        return !isDefensive ? itemArr[3] : '';
      });
      const filtered: string[] = items.filter((item) => item !== '');
      return filtered;
    });
  }

  async setItemKill(muzzleId: number, activeItems: string[]) {
    return await Promise.all(
      activeItems.map(async (itemId: string) => {
        const itemKill = new ItemKill();
        itemKill.itemId = +itemId;
        itemKill.muzzleId = muzzleId;
        return await getRepository(ItemKill).insert(itemKill);
      }),
    );
  }

  async getTimeModifiers(userId: string, teamId: string) {
    const modifiers = await getRepository(Item).find({ where: { isTimeModifier: true } });
    const time: number[] = await Promise.all(
      modifiers.map(async (modifier): Promise<number> => {
        return this.redisService
          .getPattern(this.getRedisKeyName(userId, teamId, modifier.id))
          .then((result): number => {
            return result.length
              ? getMsForSpecifiedRange(modifier.min_modified_ms, modifier.max_modified_ms) * result.length
              : 0;
          });
      }),
    );

    return time.reduce((accum, value) => accum + value);
  }

  async isProtected(userId: string, teamId: string): Promise<string | false> {
    const protectorItems = await getRepository(Item).find({ where: { isDefensive: true } });

    const activeProtection: string[][] = await Promise.all(
      protectorItems.map(async (item) => {
        return this.redisService.getPattern(this.getRedisKeyName(userId, teamId, item.id));
      }),
    );

    const flat = activeProtection.flat();

    return flat.length > 0 && flat[0];
  }

  removeKey(key: string): Promise<number> {
    return this.redisService.removeKey(key);
  }

  // TODO: Fix this query. This is so nasty.
  async buyItem(itemId: number, userId: string, teamId: string): Promise<string> {
    const itemById = await getRepository(Item).findOne({ where: { id: itemId } });
    const userById = await getRepository(SlackUser).findOne({ where: { slackId: userId, teamId } });
    const priceByTeam = await getManager().query(
      `SELECT * FROM price WHERE itemId=${itemId} AND teamId='${teamId}' AND createdAt=(SELECT MAX(createdAt) FROM price WHERE itemId=${itemId} AND teamId='${teamId}');`,
    );
    if (itemById && userById) {
      const purchase = new Purchase();
      purchase.item = itemById.id;
      purchase.price = priceByTeam[0].price;
      purchase.user = userById.slackId;
      return getRepository(Purchase)
        .insert(purchase)
        .then(() => `Congratulations! You have purchased *_${itemById.name}!_*`)
        .catch((e) => {
          this.logger.error('Error on updating purchase table');
          this.logger.error(e);
          return `Sorry, unable to buy ${itemById.name}. Please try again later.`;
        });
    }
    return `Sorry, unable to buy your item at this time. Please try again later.`;
  }

  // TODO: Fix this query.
  async useItem(itemId: number, userId: string, teamId: string, userIdForItem?: string): Promise<string> {
    const usingUser: SlackUser | null = await getRepository(SlackUser).findOne({
      where: { slackId: userId, teamId },
    });
    const receivingUser: SlackUser | null = await getRepository(SlackUser).findOne({
      where: {
        slackId: userIdForItem,
        teamId,
      },
    });
    const itemById: Item | null = await getRepository(Item).findOne({ where: { id: itemId } });
    if (itemById?.isEffect) {
      const keyName = this.getRedisKeyName(receivingUser ? receivingUser.slackId : userId, teamId, itemId);
      const existingKey = await this.redisService.getPattern(keyName);
      if (existingKey.length) {
        if (itemById?.isStackable) {
          this.redisService.setValueWithExpire(
            `${keyName}.${existingKey.length}`,
            `${userId}-${teamId}`,
            'PX',
            getMsForSpecifiedRange(itemById.min_active_ms, itemById.max_active_ms),
          );
        } else if (!itemById?.isStackable) {
          throw new Error(`Unable to use your item. This item is not stackable.`);
        }
      } else if (!existingKey.length && itemById) {
        if (itemById.min_active_ms !== 0 && itemById.max_active_ms !== 0) {
          this.redisService.setValueWithExpire(
            keyName,
            `${userId}-${teamId}`,
            'PX',
            getMsForSpecifiedRange(itemById.min_active_ms, itemById.max_active_ms),
          );
        } else {
          this.redisService.setValue(keyName, 'true');
        }
      }
    }

    const usedItem = new UsedItem();
    usedItem.item = itemById!.id;
    usedItem.usedOnUser = receivingUser ? receivingUser.id : usingUser!.id;
    usedItem.usingUser = usingUser!.id;
    await getRepository(UsedItem).insert(usedItem);

    return `${itemById?.name} used!`;
  }

  getUserOfUsedItem(key: string) {
    return this.redisService.getValue(key);
  }

  isUserRequired(itemId: number): Promise<boolean> {
    return getRepository(Item)
      .findOne({ where: { id: itemId } })
      .then((item) => {
        if (item) {
          return item.requiresUser;
        } else {
          return false;
        }
      });
  }

  getRedisKeyName(userId: string, teamId: string, itemId?: number): string {
    return `store.item.${userId}-${teamId}${itemId ? `.${itemId}` : ''}`;
  }
}
