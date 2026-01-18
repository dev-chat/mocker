import { logger } from '../shared/logger/logger';
import { Event, EventRequest } from '../shared/models/slack/slack-models';
import { reactionValues } from './constants';
import { ReactionPersistenceService } from './reaction.persistence.service';

export class ReactionService {
  private reactionPersistenceService = new ReactionPersistenceService();
  logger = logger.child({ module: 'ReactionService' });

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
      this.reactionPersistenceService.saveReaction(event, reactionValue, teamId).catch((e) => this.logger.error(e));
    }
  }

  private handleRemovedReaction(event: Event, teamId: string): void {
    const reactionValue = reactionValues[event.reaction];
    if (this.shouldReactionBeLogged(reactionValue)) {
      this.reactionPersistenceService.removeReaction(event, teamId);
    }
  }

  handle(request: EventRequest): void {
    if (request.event.type === 'reaction_added' || request.event.type === 'reaction_removed') {
      this.handleReaction(request.event, request.event.type === 'reaction_added', request.team_id);
    }
  }
}
