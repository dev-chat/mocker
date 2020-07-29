import { Event } from '../../shared/models/slack/slack-models';
import { reactionValues } from './constants';
import { ReactionPersistenceService } from './reaction.persistence.service';

export class ReactionService {
  private reactionPersistenceService = ReactionPersistenceService.getInstance();

  public handleReaction(event: Event, isAdded: boolean, teamId: string): void {
    if (event.user && event.item_user && event.user !== event.item_user) {
      if (isAdded) {
        this.handleAddedReaction(event, teamId);
      } else if (!isAdded) {
        this.handleRemovedReaction(event, teamId);
      }
    } else {
      console.log(
        `${event.user} responded to ${event.item_user} message and no action was taken. This was a self-reaction or a reaction to a bot message.`,
      );
    }
  }

  private shouldReactionBeLogged(reactionValue: number | undefined): boolean {
    return reactionValue === 1 || reactionValue === -1;
  }

  private handleAddedReaction(event: Event, teamId: string): void {
    const reactionValue = reactionValues[event.reaction];
    // Log event to DB.
    if (this.shouldReactionBeLogged(reactionValue)) {
      console.log(
        `Adding reaction to ${event.item_user} for ${event.user}'s reaction: ${event.reaction}, yielding him ${reactionValue}`,
      );
      this.reactionPersistenceService.saveReaction(event, reactionValue, teamId);
    }
  }

  private handleRemovedReaction(event: Event, teamId: string): void {
    const reactionValue = reactionValues[event.reaction];
    if (this.shouldReactionBeLogged(reactionValue)) {
      this.reactionPersistenceService.removeReaction(event, reactionValue, teamId);
      console.log(`Removing rep from ${event.item_user} for ${event.user}'s reaction: ${event.reaction}`);
    }
  }
}
