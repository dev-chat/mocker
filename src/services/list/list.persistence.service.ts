import { getRepository } from 'typeorm';
import { List } from '../../shared/db/models/List';

export class ListPersistenceService {
  public static getInstance(): ListPersistenceService {
    if (!ListPersistenceService.instance) {
      ListPersistenceService.instance = new ListPersistenceService();
    }
    return ListPersistenceService.instance;
  }

  private static instance: ListPersistenceService;

  public store(requestorId: string, text: string): Promise<List> {
    const listItem = new List();
    listItem.requestorId = requestorId;
    listItem.text = text;
    return getRepository(List).save(listItem);
  }

  public retrieve(): Promise<List[]> {
    return getRepository(List).find();
  }

  public remove(text: string): Promise<List> {
    return new Promise(async (resolve, reject) => {
      const item = await getRepository(List).findOne({ text });
      if (item) {
        return resolve(getRepository(List).remove(item));
      }
      reject(`Unable to find \`${text}\``);
    });
  }
}
