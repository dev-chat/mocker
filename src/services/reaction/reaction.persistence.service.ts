import { DataSource } from 'typeorm';
import { Purchase } from '../../shared/db/models/Purchase';
import { Reaction } from '../../shared/db/models/Reaction';
import { Rep } from '../../shared/db/models/Rep';
import { SlackUser } from '../../shared/db/models/SlackUser';
import { ReactionByUser } from '../../shared/models/reaction/ReactionByUser.model';
import { Event } from '../../shared/models/slack/slack-models';
import { TotalRep } from './reaction.interface';
export class ReactionPersistenceService {
  ds: DataSource;

  constructor(ds: DataSource) {
    this.ds = ds;
  }

  public saveReaction(event: Event, value: number, teamId: string): Promise<Reaction> {
    const reaction = new Reaction();
    reaction.affectedUser = event.item_user;
    reaction.reactingUser = event.user;
    reaction.reaction = event.reaction;
    reaction.value = value;
    reaction.type = event.item.type;
    reaction.channel = event.item.channel;
    reaction.teamId = teamId;

    return this.ds.getRepository(Reaction).save(reaction);
  }

  public async removeReaction(event: Event, teamId: string): Promise<void> {
    await this.ds
      .getRepository(Reaction)
      .delete({
        reaction: event.reaction,
        affectedUser: event.item_user,
        reactingUser: event.user,
        type: event.item.type,
        channel: event.item.channel,
        teamId: teamId,
      })
      .catch((e) => e);
  }

  public async getTotalRep(userId: string, teamId: string): Promise<TotalRep> {
    await this.ds.getRepository(Rep).increment({ user: userId, teamId }, 'timesChecked', 1);
    const user = await this.ds.getRepository(SlackUser).findOne({ where: { slackId: userId, teamId } });
    if (!user) {
      throw new Error(`Unable to find user: ${userId} on team ${teamId}`);
    }

    const totalRepEarnedQuery = 'SELECT SUM(VALUE) as sum FROM reaction WHERE affectedUser=? AND teamId=?;';
    const totalRepEarned = await this.ds
      .getRepository(Reaction)
      .query(totalRepEarnedQuery, [user.slackId, user.teamId])
      .then((x) => (!x[0].sum ? 0 : x[0].sum));

    const totalRepSpentQuery = 'SELECT SUM(PRICE) as sum FROM purchase WHERE user=?;';
    const totalRepSpent = await this.ds
      .getRepository(Purchase)
      .query(totalRepSpentQuery, [user.slackId])
      .then((x) => (!x[0].sum ? 0 : x[0].sum));

    console.log(totalRepEarned);
    console.log(totalRepSpent);
    console.log(totalRepEarned - totalRepSpent);

    return { totalRepEarned, totalRepSpent, totalRepAvailable: totalRepEarned - totalRepSpent };
  }

  public getRepByUser(userId: string, teamId: string): Promise<ReactionByUser[]> {
    return this.ds
      .getRepository(Reaction)
      .query(
        `SELECT reactingUser, SUM(value) as rep FROM reaction WHERE affectedUser=? AND teamId=? GROUP BY reactingUser ORDER BY rep DESC;`,
        [userId, teamId],
      )
      .then((value) => value)
      .catch((e) => {
        throw new Error(e);
      });
  }
}
