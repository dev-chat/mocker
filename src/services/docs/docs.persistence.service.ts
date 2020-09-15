import { getRepository } from 'typeorm';
import { Docs } from '../../shared/db/models/Docs';

export class DocsPersistenceService {
  public static getInstance(): DocsPersistenceService {
    if (!DocsPersistenceService.instance) {
      DocsPersistenceService.instance = new DocsPersistenceService();
    }
    return DocsPersistenceService.instance;
  }

  private static instance: DocsPersistenceService;

  public store(requestorId: string, text: string, teamId: string): Promise<Docs> {
    const docItem = new Docs();
    docItem.requestorId = requestorId;
    docItem.text = text;
    docItem.teamId = teamId;
    return getRepository(Docs).save(docItem);
  }

  public remove(text: string): Promise<Docs> {
    return new Promise(async (resolve, reject) => {
      const item = await getRepository(Docs).findOne({ text });
      if (item) {
        return resolve(getRepository(Docs).remove(item));
      }
      reject(`Unable to find \`${text}\``);
    });
  }
}
