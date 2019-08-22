import { getRepository } from "typeorm";
import { List } from "../../shared/db/models/List";

export class ListPersistenceService {
  public static getInstance() {
    if (!ListPersistenceService.instance) {
      ListPersistenceService.instance = new ListPersistenceService();
    }
    return ListPersistenceService.instance;
  }

  private static instance: ListPersistenceService;

  private constructor() {}

  public store(requestorId: string, text: string) {
    const listItem = new List();
    listItem.requestorId = requestorId;
    listItem.text = text;
    return getRepository(List).save(listItem);
  }

  public retrieve() {
    return getRepository(List).find();
  }

  public remove(text: string) {
    return new Promise(async (resolve, reject) => {
      const item = await getRepository(List).findOne({ text });
      if (item) {
        return resolve(getRepository(List).remove(item));
      }
      reject(`Unable to find \`${text}\``);
    });
  }
}
