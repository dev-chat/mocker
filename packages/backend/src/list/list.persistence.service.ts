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

  public async remove(text: string): Promise<List> {
    const item = await getRepository(List).findOne({ where: { text } });
    if (item) {
      return getRepository(List).remove(item);
    }

    throw new Error(`Unable to find \`${text}\``);
  }
}
