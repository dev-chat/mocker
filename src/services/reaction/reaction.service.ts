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
    }
  }

  private shouldReactionBeLogged(reactionValue: number | undefined): boolean {
    return reactionValue === 1 || reactionValue === -1;
  }

  private handleAddedReaction(event: Event, teamId: string): void {
    const reactionValue = reactionValues[event.reaction];
    // Log event to DB.
    if (this.shouldReactionBeLogged(reactionValue)) {
      this.reactionPersistenceService.saveReaction(event, reactionValue, teamId).catch(e => console.error(e));
    }
  }

  private handleRemovedReaction(event: Event, teamId: string): void {
    const reactionValue = reactionValues[event.reaction];
    if (this.shouldReactionBeLogged(reactionValue)) {
      this.reactionPersistenceService.removeReaction(event, reactionValue, teamId);
    }
  }
}
