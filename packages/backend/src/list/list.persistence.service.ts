import { getRepository } from 'typeorm';
import { List } from '../shared/db/models/List';
import { logError } from '../shared/logger/error-logging';
import { logger } from '../shared/logger/logger';

export class ListPersistenceService {
  private logger = logger.child({ module: 'ListPersistenceService' });

  public store(requestorId: string, text: string, teamId: string, channelId: string): Promise<List> {
    const listItem = new List();
    listItem.requestorId = requestorId;
    listItem.text = text;
    listItem.teamId = teamId;
    listItem.channelId = channelId;
    return getRepository(List)
      .save(listItem)
      .catch((e) => {
        logError(this.logger, 'Failed to store list item', e, {
          requestorId,
          teamId,
          channelId,
          text,
        });
        throw e;
      });
  }

  public async remove(text: string): Promise<List> {
    const item = await getRepository(List)
      .findOne({ where: { text } })
      .catch((e) => {
        logError(this.logger, 'Failed to retrieve list item for removal', e, { text });
        throw e;
      });
    if (item) {
      return getRepository(List)
        .remove(item)
        .catch((e) => {
          logError(this.logger, 'Failed to remove list item', e, { text, itemId: item.id });
          throw e;
        });
    }

    throw new Error(`Unable to find \`${text}\``);
  }
}
