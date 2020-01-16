import { IEvent } from "../../shared/models/slack/slack-models";
import { negativeReactions, positiveReactions } from "./constants";

export class ReactionService {
  public handleReaction(event: IEvent, isAdded: boolean) {
    if (event.user !== event.item_user) {
      const isPositive = this.isReactionPositive(event.reaction);
      const isNegative = this.isReactionNegative(event.reaction);
      if ((isAdded && isPositive) || (!isAdded && isNegative)) {
        // Log event to DB.
        // Add rep to affected user.
        console.log(
          `Adding rep to ${event.item_user} for ${event.user}'s reaction: ${
            event.reaction
          }`
        );
      } else if ((isAdded && isNegative) || (!isAdded && isPositive)) {
        // Log event to DB.
        // Remove rep from affected_user.
        console.log(
          `Removing rep from ${event.item_user} for ${event.user}'s reaction: ${
            event.reaction
          }`
        );
      } else {
        // Log event to DB.
        console.log(
          `No rep changes for ${event.item_user} from ${
            event.user
          }. Reaction: ${event.reaction} was not positive or negative. `
        );
      }
    } else {
      console.log(
        `${event.user} responded to ${
          event.item_user
        } message and no action was taken. This was a self-reaction.`
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
