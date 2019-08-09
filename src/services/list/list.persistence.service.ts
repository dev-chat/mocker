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

  // Not being used rn.
  public async remove(itemId: string) {
    const item = await getRepository(List).findOne(itemId);
    if (item) {
      return getRepository(List).remove(item);
    }
    return new Error(`Unable to find item by id ${itemId}`);
  }
}
