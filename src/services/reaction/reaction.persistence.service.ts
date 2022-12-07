import { getRepository } from 'typeorm';
import { Purchase } from '../../shared/db/models/Purchase';
import { Reaction } from '../../shared/db/models/Reaction';
import { Rep } from '../../shared/db/models/Rep';
import { SlackUser } from '../../shared/db/models/SlackUser';
import { ReactionByUser } from '../../shared/models/reaction/ReactionByUser.model';
import { Event } from '../../shared/models/slack/slack-models';
import { TotalRep } from './reaction.interface';
export class ReactionPersistenceService {
  public static getInstance(): ReactionPersistenceService {
    if (!ReactionPersistenceService.instance) {
      ReactionPersistenceService.instance = new ReactionPersistenceService();
    }
    return ReactionPersistenceService.instance;
  }

  private static instance: ReactionPersistenceService;

  public saveReaction(event: Event, value: number, teamId: string): Promise<Reaction> {
    const reaction = new Reaction();
    reaction.affectedUser = event.item_user;
    reaction.reactingUser = event.user;
    reaction.reaction = event.reaction;
    reaction.value = value;
    reaction.type = event.item.type;
    reaction.channel = event.item.channel;
    reaction.teamId = teamId;

    return getRepository(Reaction).save(reaction);
  }

  public async removeReaction(event: Event, teamId: string): Promise<void> {
    await getRepository(Reaction)
      .delete({
        reaction: event.reaction,
        affectedUser: event.item_user,
        reactingUser: event.user,
        type: event.item.type,
        channel: event.item.channel,
        teamId: teamId,
      })
      .catch(e => e);
  }

  public async getTotalRep(userId: string, teamId: string): Promise<TotalRep> {
    await getRepository(Rep).increment({ user: userId, teamId }, 'timesChecked', 1);
    const totalRepEarnedQuery = 'SELECT SUM(VALUE) FROM reaction WHERE affectedUser=? AND teamId=?;';
    const totalRepEarned = await getRepository(Reaction)
      .query(totalRepEarnedQuery, [userId, teamId])
      .then(x => (!x ? 0 : x));
    const dbUserId = await getRepository(SlackUser)
      .findOne({ slackId: userId, teamId })
      .then(x => x?.id);
    const totalRepSpentQuery = 'SELECT SUM(PRICE) FROM purchase WHERE user=?;';
    const totalRepSpent = await getRepository(Purchase)
      .query(totalRepSpentQuery, [dbUserId])
      .then(x => (!x ? 0 : x));

    return { totalRepEarned, totalRepSpent, totalRepAvailable: totalRepEarned - totalRepSpent };
  }

  public getRepByUser(userId: string, teamId: string): Promise<ReactionByUser[]> {
    return getRepository(Reaction)
      .query(
        `SELECT reactingUser, SUM(value) as rep FROM reaction WHERE affectedUser=? AND teamId=? GROUP BY reactingUser ORDER BY rep DESC;`,
        [userId, teamId],
      )
      .then(value => value)
      .catch(e => {
        throw new Error(e);
      });
  }
}
