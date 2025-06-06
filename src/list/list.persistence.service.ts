import { getRepository } from 'typeorm';
import { List } from '../shared/db/models/List';

export class ListPersistenceService {
  public store(requestorId: string, text: string, teamId: string, channelId: string): Promise<List> {
    const listItem = new List();
    listItem.requestorId = requestorId;
    listItem.text = text;
    listItem.teamId = teamId;
    listItem.channelId = channelId;
    return getRepository(List).save(listItem);
  }

  public remove(text: string): Promise<List> {
    return new Promise(async (resolve, reject) => {
      const item = await getRepository(List).findOne({ where: { text } });
      if (item) {
        return resolve(getRepository(List).remove(item));
      }
      reject(`Unable to find \`${text}\``);
    });
  }
}
