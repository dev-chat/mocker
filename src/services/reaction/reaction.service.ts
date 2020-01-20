import { IEvent } from "../../shared/models/slack/slack-models";
import { negativeReactions, positiveReactions } from "./constants";
import { ReactionPersistenceService } from "./reaction.persistence.service";

export class ReactionService {
  private reactionPersistenceService = ReactionPersistenceService.getInstance();

  public handleReaction(event: IEvent, isAdded: boolean) {
    console.log(event);
    if (event.user !== event.item_user) {
      if (isAdded) {
        this.handleAddedReaction(event);
      } else if (!isAdded) {
        this.handleRemovedReaction(event);
      }
    } else {
      console.log(
        `${event.user} responded to ${
          event.item_user
        } message and no action was taken. This was a self-reaction.`
      );
    }
  }

  private handleAddedReaction(event: IEvent) {
    const isPositive = this.isReactionPositive(event.reaction);
    const isNegative = this.isReactionNegative(event.reaction);
    // Log event to DB.
    this.reactionPersistenceService.saveReaction(
      event,
      isPositive ? 1 : isNegative ? -1 : 0
    );
    console.log(
      `Adding rep to ${event.item_user} for ${event.user}'s reaction: ${
        event.reaction
      }`
    );
  }

  private handleRemovedReaction(event: IEvent) {
    // Log event to DB.
    this.reactionPersistenceService.removeReaction(event);
    console.log(
      `Removing rep from ${event.item_user} for ${event.user}'s reaction: ${
        event.reaction
      }`
    );
  }

  private isReactionPositive(reaction: string) {
    return positiveReactions.includes(reaction);
  }

  private isReactionNegative(reaction: string) {
    return negativeReactions.includes(reaction);
  }
}
