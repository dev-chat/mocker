import { DataSource } from 'typeorm';
import { List } from '../../shared/db/models/List';

export class ListPersistenceService {
  ds: DataSource;

  constructor(ds: DataSource) {
    this.ds = ds;
  }

  public store(requestorId: string, text: string, teamId: string, channelId: string): Promise<List> {
    const listItem = new List();
    listItem.requestorId = requestorId;
    listItem.text = text;
    listItem.teamId = teamId;
    listItem.channelId = channelId;
    return this.ds.getRepository(List).save(listItem);
  }

  public async remove(text: string): Promise<List> {
    const item = await this.ds.getRepository(List).findOne({ where: { text } });
    if (item) {
      return this.ds.getRepository(List).remove(item);
    }
    return Promise.reject(`Unable to find \`${text}\``);
  }
}
