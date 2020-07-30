import { getRepository } from 'typeorm';
import { Reaction } from '../../shared/db/models/Reaction';
import { Rep } from '../../shared/db/models/Rep';
import { Event } from '../../shared/models/slack/slack-models';

export class ReactionPersistenceService {
  public static getInstance(): ReactionPersistenceService {
    if (!ReactionPersistenceService.instance) {
      ReactionPersistenceService.instance = new ReactionPersistenceService();
    }
    return ReactionPersistenceService.instance;
  }

  private static instance: ReactionPersistenceService;

  public saveReaction(event: Event, value: number, teamId: string): Promise<Reaction> {
    return new Promise(async (resolve, reject) => {
      const reaction = new Reaction();
      reaction.affectedUser = event.item_user;
      reaction.reactingUser = event.user;
      reaction.reaction = event.reaction;
      reaction.value = value;
      reaction.type = event.item.type;
      reaction.channel = event.item.channel;
      reaction.teamId = teamId;

      // Kind ugly dawg, wtf.
      await getRepository(Reaction)
        .save(reaction)
        .then(async () => {
          if (value === 1) {
            await this.incrementRep(event.item_user, teamId)
              .then(() => resolve())
              .catch(e => reject(e));
          } else {
            await this.decrementRep(event.item_user, teamId)
              .then(() => resolve())
              .catch(e => reject(e));
          }
        })
        .catch(e => console.error(e));
    });
  }

  public async removeReaction(event: Event, value: number, teamId: string): Promise<void> {
    await getRepository(Reaction)
      .delete({
        reaction: event.reaction,
        affectedUser: event.item_user,
        reactingUser: event.user,
        type: event.item.type,
        channel: event.item.channel,
        teamId: teamId,
      })
      .then(() => {
        value === 1 ? this.decrementRep(event.item_user, teamId) : this.incrementRep(event.item_user, teamId);
      })
      .catch(e => e);
  }

  public getUserRep(userId: string, teamId: string) {
    return getRepository(Rep)
      .findOne({ user: userId, teamId })
      .then(rep => rep?.rep);
  }

  private async isRepUserPresent(affectedUser: string, teamId: string): Promise<boolean | void> {
    return getRepository(Rep)
      .findOne({ user: affectedUser, teamId })
      .then(user => !!user)
      .catch(e => console.error(e));
  }

  private incrementRep(affectedUser: string, teamId: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      // Check for affectedUser
      const isUserExisting = await this.isRepUserPresent(affectedUser, teamId);

      if (isUserExisting) {
        // If it exists, increment rep by one.
        return getRepository(Rep)
          .increment({ user: affectedUser, teamId }, 'rep', 1)
          .then(() => resolve())
          .catch(e => reject(e));
      } else {
        // If it does not exist, create a new user with a rep of 1.
        const newRepUser = new Rep();
        newRepUser.user = affectedUser;
        newRepUser.rep = 1;
        newRepUser.teamId = teamId;
        return getRepository(Rep)
          .save(newRepUser)
          .then(() => resolve())
          .catch(e => reject(e));
      }
    });
  }

  private decrementRep(affectedUser: string, teamId: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      // Check for affectedUser
      const isUserExisting = await this.isRepUserPresent(affectedUser, teamId);

      if (isUserExisting) {
        // If it exists, decrement rep by one.
        return getRepository(Rep)
          .decrement({ user: affectedUser, teamId }, 'rep', 1)
          .then(() => resolve())
          .catch(e => reject(e));
      } else {
        // If it does not exist, create a new user with a rep of -1.
        const newRepUser = new Rep();
        newRepUser.user = affectedUser;
        newRepUser.rep = -1;
        newRepUser.teamId = teamId;
        return getRepository(Rep)
          .save(newRepUser)
          .then(() => resolve())
          .catch(e => reject(e));
      }
    });
  }
}
