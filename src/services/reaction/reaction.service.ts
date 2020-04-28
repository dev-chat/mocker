import Table from 'easy-table';
import { ReactionByUser } from '../../shared/models/reaction/ReactionByUser.model';
import { Event } from '../../shared/models/slack/slack-models';
import { SlackService } from '../slack/slack.service';
import { reactionValues } from './constants';
import { ReactionPersistenceService } from './reaction.persistence.service';

export class ReactionService {
  private reactionPersistenceService = ReactionPersistenceService.getInstance();
  private slackService = SlackService.getInstance();

  public async getRep(userId: string): Promise<string> {
    const totalRep = await this.reactionPersistenceService
      .getRep(userId)
      .then(value => {
        if (value) {
          return `\n*You currently have _${value!.rep}_ rep.*`;
        } else {
          return `You do not currently have any rep.`;
        }
      })
      .catch(() => `Unable to retrieve your rep due to an error!`);

    const repByUser = await this.reactionPersistenceService
      .getRepByUser(userId)
      .then((perUserRep: ReactionByUser[] | undefined) => this.formatRepByUser(perUserRep))
      .catch(e => console.error(e));

    return `${repByUser}\n\n${totalRep}`;
  }

  public handleReaction(event: Event, isAdded: boolean): void {
    console.log(event);
    if (event.user && event.item_user && event.user !== event.item_user) {
      if (isAdded) {
        this.handleAddedReaction(event);
      } else if (!isAdded) {
        this.handleRemovedReaction(event);
      }
    } else {
      console.log(
        `${event.user} responded to ${
          event.item_user
        } message and no action was taken. This was a self-reaction or a reaction to a bot message.`,
      );
    }
  }

  private formatRepByUser(perUserRep: ReactionByUser[] | undefined): string {
    if (!perUserRep) {
      return 'You do not have any existing relationships.';
    } else {
      const formattedData = perUserRep.map(userRep => {
        return {
          user: this.slackService.getUserName(userRep.reactingUser),
          rep: `${this.getSentiment(userRep.rep)} (${userRep.rep})`,
        };
      });
      return `${Table.print(formattedData)}`;
    }
  }

  private getSentiment(rep: number): string {
    if (rep >= 1000) {
      return 'Worshipped';
    } else if (rep >= 900 && rep < 1000) {
      return 'Enamored';
    } else if (rep >= 800 && rep < 900) {
      return 'Adored';
    } else if (rep >= 700 && rep < 800) {
      return 'Loved';
    } else if (rep >= 600 && rep < 700) {
      return 'Endeared';
    } else if (rep >= 500 && rep < 600) {
      return 'Admired';
    } else if (rep >= 400 && rep < 500) {
      return 'Esteemed';
    } else if (rep >= 300 && rep < 400) {
      return 'Well Liked';
    } else if (rep >= 200 && rep < 300) {
      return 'Liked';
    } else if (rep >= 100 && rep < 200) {
      return 'Respected';
    } else if (rep >= -300 && rep < 100) {
      return 'Neutral';
    } else if (rep >= -500 && rep < -300) {
      return 'Unfriendly';
    } else if (rep >= -700 && rep < -500) {
      return 'Disliked';
    } else if (rep >= -1000 && rep < -700) {
      return 'Scorned';
    } else if (rep >= -1000) {
      return 'Hated';
    } else {
      return 'Neutral';
    }
  }

  private shouldReactionBeLogged(reactionValue: number | undefined): boolean {
    return reactionValue === 1 || reactionValue === -1;
  }

  private handleAddedReaction(event: Event): void {
    const reactionValue = reactionValues[event.reaction];
    // Log event to DB.
    if (this.shouldReactionBeLogged(reactionValue)) {
      console.log(
        `Adding reaction to ${event.item_user} for ${event.user}'s reaction: ${
          event.reaction
        }, yielding him ${reactionValue}`,
      );
      this.reactionPersistenceService.saveReaction(event, reactionValue);
    }
  }

  private handleRemovedReaction(event: Event): void {
    const reactionValue = reactionValues[event.reaction];
    if (this.shouldReactionBeLogged(reactionValue)) {
      this.reactionPersistenceService.removeReaction(event, reactionValue);
      console.log(`Removing rep from ${event.item_user} for ${event.user}'s reaction: ${event.reaction}`);
    }
  }
}
