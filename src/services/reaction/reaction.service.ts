import { IEvent } from "../../shared/models/slack/slack-models";
import { reactionValues } from "./constants";
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

  private shouldReactionBeLogged(reactionValue: number | undefined) {
    return reactionValue === 1 || reactionValue === -1;
  }

  private handleAddedReaction(event: IEvent) {
    const reactionValue = reactionValues[event.reaction];
    // Log event to DB.
    if (this.shouldReactionBeLogged(reactionValue)) {
      console.log(
        `Adding reaction to ${event.item_user} for ${event.user}'s reaction: ${
          event.reaction
        }, yielding him ${reactionValue}`
      );
      this.reactionPersistenceService.saveReaction(event, reactionValue);
    }
  }

  private handleRemovedReaction(event: IEvent) {
    const reactionValue = reactionValues[event.reaction];
    if (this.shouldReactionBeLogged(reactionValue)) {
      // Log event to DB.
      this.reactionPersistenceService.removeReaction(event);
      console.log(
        `Removing rep from ${event.item_user} for ${event.user}'s reaction: ${
          event.reaction
        }`
      );
    }
  }
}
