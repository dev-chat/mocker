import { negativeReactions, positiveReactions } from "./constants";

export class ReactionService {
  public handleReaction(
    reaction: string,
    affectedUser: string,
    user: string,
    isAdded: boolean
  ) {
    if (user !== affectedUser) {
      const isPositive = this.isReactionPositive(reaction);
      const isNegative = this.isReactionNegative(reaction);
      if ((isAdded && isPositive) || (!isAdded && isNegative)) {
        // Log event to DB.
        // Add rep to affected user.
        console.log(
          `Adding rep to ${affectedUser} for ${user}'s reaction: ${reaction}`
        );
      } else if ((isAdded && isNegative) || (!isAdded && isPositive)) {
        // Log event to DB.
        // Remove rep from affected_user.
        console.log(
          `Removing rep from ${affectedUser} for ${user}'s reaction: ${reaction}`
        );
      } else {
        // Log event to DB.
        console.log(
          `No rep changes for ${affectedUser} from ${user}. Reaction: ${reaction} was not positive or negative. `
        );
      }
    } else {
      console.log(
        `${user} responded to ${affectedUser} message and no action was taken. This was a self-reaction.`
      );
    }
  }

  private isReactionPositive(reaction: string) {
    return positiveReactions.includes(reaction);
  }

  private isReactionNegative(reaction: string) {
    return negativeReactions.includes(reaction);
  }
}
