import { getRepository } from "typeorm";
import { Reaction } from "../../shared/db/models/Reaction";
import { Rep } from "../../shared/db/models/Rep";
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
      reaction.channel = event.item.channel;

      // Kind ugly dawg, wtf.
      await getRepository(Reaction)
        .save(reaction)
        .then(async () => {
          if (value === 1) {
            await this.incrementRep(event.item_user)
              .then(() => resolve())
              .catch(e => reject(e));
          } else {
            await this.decrementRep(event.item_user)
              .then(() => resolve())
              .catch(e => reject(e));
          }
        })
        .catch(e => console.error(e));
    });
  }

  public async removeReaction(event: IEvent, value: number) {
    await getRepository(Reaction)
      .delete({
        reaction: event.reaction,
        affectedUser: event.item_user,
        reactingUser: event.user,
        type: event.item.type,
        channel: event.item.channel
      })
      .then(() => {
        value === 1
          ? this.decrementRep(event.item_user)
          : this.incrementRep(event.item_user);
      })
      .catch(e => e);
  }

  private async isRepUserPresent(affectedUser: string) {
    return getRepository(Rep)
      .findOne({ user: affectedUser })
      .then(user => !!user)
      .catch(e => console.error(e));
  }

  private incrementRep(affectedUser: string) {
    return new Promise(async (resolve, reject) => {
      // Check for affectedUser
      const isUserExisting = await this.isRepUserPresent(affectedUser);

      if (isUserExisting) {
        // If it exists, increment rep by one.
        return getRepository(Rep)
          .increment({ user: affectedUser }, "rep", 1)
          .then(() => resolve())
          .catch(e => reject(e));
      } else {
        // If it does not exist, create a new user with a rep of 1.
        const newRepUser = new Rep();
        newRepUser.user = affectedUser;
        newRepUser.rep = 1;
        return getRepository(Rep)
          .save(newRepUser)
          .then(() => resolve())
          .catch(e => reject(e));
      }
    });
  }

  private decrementRep(affectedUser: string) {
    return new Promise(async (resolve, reject) => {
      // Check for affectedUser
      const isUserExisting = await this.isRepUserPresent(affectedUser);

      if (isUserExisting) {
        // If it exists, decrement rep by one.
        return getRepository(Rep)
          .decrement({ user: affectedUser }, "rep", 1)
          .then(() => resolve())
          .catch(e => reject(e));
      } else {
        // If it does not exist, create a new user with a rep of -1.
        const newRepUser = new Rep();
        newRepUser.user = affectedUser;
        newRepUser.rep = -1;
        return getRepository(Rep)
          .save(newRepUser)
          .then(() => resolve())
          .catch(e => reject(e));
      }
    });
  }
}
