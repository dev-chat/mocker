import { getRepository } from "typeorm";
import { Reaction } from "../../shared/db/models/Reaction";
import { IEvent } from "../../shared/models/slack/slack-models";

export class ReactionPersistenceService {
  public static getInstance() {
    if (!ReactionPersistenceService.instance) {
      ReactionPersistenceService.instance = new ReactionPersistenceService();
    }
    return ReactionPersistenceService.instance;
  }

  private static instance: ReactionPersistenceService;

  private constructor() {}

  public saveReaction(event: IEvent, value: number) {
    return new Promise(async (resolve, reject) => {
      const reaction = new Reaction();
      reaction.affectedUser = event.item_user;
      reaction.reactingUser = event.user;
      reaction.reaction = event.reaction;
      reaction.value = value;
      reaction.type = event.item.type;

      await getRepository(Reaction)
        .save(reaction)
        .then(() => resolve())
        .catch(e => reject(e));
    });
  }

  public async removeReaction(event: IEvent) {
    await getRepository(Reaction)
      .delete({
        reaction: event.reaction,
        affectedUser: event.item_user,
        reactingUser: event.user,
        type: event.item.type
      })
      .catch(e => e);
  }
}