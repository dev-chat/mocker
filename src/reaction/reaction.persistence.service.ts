import { getRepository } from 'typeorm';

import { TotalRep } from './reaction.interface';
import { Purchase } from '../shared/db/models/Purchase';
import { Reaction } from '../shared/db/models/Reaction';
import { Rep } from '../shared/db/models/Rep';
import { SlackUser } from '../shared/db/models/SlackUser';
import { ReactionByUser } from '../shared/models/reaction/ReactionByUser.model';
import { Event } from '../shared/models/slack/slack-models';
import { PortfolioTransactions } from '../shared/db/models/PortfolioTransaction';
import { logger } from '../shared/logger/logger';

export class ReactionPersistenceService {
  customLogger = logger.child('ReactionPersistenceService');

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
      .catch((e) => e);
  }

  public async getTotalRep(userId: string, teamId: string): Promise<TotalRep> {
    await getRepository(Rep).increment({ user: userId, teamId }, 'timesChecked', 1);

    const userRepo = getRepository(SlackUser);
    const user = await userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.portfolio', 'portfolio')
      .where('user.slackId = :userId', { userId })
      .andWhere('user.teamId = :teamId', { teamId })
      .getOne();

    if (!user) {
      throw new Error(`Unable to find user: ${userId} on team ${teamId}`);
    }

    const earnedQuery = getRepository(Reaction)
      .createQueryBuilder('reaction')
      .select('CAST(SUM(reaction.value) as DECIMAL(18,8))', 'sum')
      .where('reaction.affectedUser = :userId', { userId: user.slackId })
      .andWhere('reaction.teamId = :teamId', { teamId: user.teamId });

    this.customLogger.log('Earned Query:', earnedQuery.getSql());

    const totalRepEarned = await earnedQuery.getRawOne().then((result) => {
      this.customLogger.log('Earned Result:', result);
      return Number(result?.sum || 0);
    });

    const spentQuery = getRepository(Purchase)
      .createQueryBuilder('purchase')
      .select('CAST(SUM(purchase.price) as DECIMAL(18,8))', 'sum')
      .where('purchase.user = :userId', { userId: user.slackId });

    this.customLogger.log('Spent Query:', spentQuery.getSql());

    const totalRepSpent = await spentQuery.getRawOne().then((result) => {
      this.customLogger.log('Spent Result:', result);
      return Number(result?.sum || 0);
    });

    if (user.portfolio?.id) {
      // Debug the portfolio ID
      this.customLogger.log('Portfolio ID:', user.portfolio.id);

      const investedQuery = getRepository(PortfolioTransactions)
        .createQueryBuilder('pt')
        .select('SUM(pt.quantity * pt.price)', 'sum')
        .where('pt.portfolio_id = :portfolioId', { portfolioId: user.portfolio.id })
        .andWhere("pt.type = 'BUY'");

      this.customLogger.log('Invested Query:', investedQuery.getSql());

      const totalRepInvested = await investedQuery.getRawOne().then((result) => {
        this.customLogger.log('Invested Result:', result);
        return Number(result?.sum || 0);
      });

      const soldQuery = getRepository(PortfolioTransactions)
        .createQueryBuilder('pt')
        .select('SUM(pt.quantity * pt.price)', 'sum')
        .where('pt.portfolio_id = :portfolioId', { portfolioId: user.portfolio.id })
        .andWhere("pt.type = 'SELL'");

      this.customLogger.log('Sold Query:', soldQuery.getSql());

      const totalRepSold = await soldQuery.getRawOne().then((result) => {
        this.customLogger.log('Sold Result:', result);
        return Number(result?.sum || 0);
      });

      // Debug all values
      this.customLogger.log('Values:', {
        totalRepEarned,
        totalRepSpent,
        totalRepInvested,
        totalRepSold,
      });

      const totalRepInvestedNet = totalRepSold - totalRepInvested;

      const result = {
        totalRepEarned,
        totalRepSpent,
        totalRepAvailable: totalRepEarned + totalRepInvestedNet - totalRepSpent,
        totalRepInvested,
        totalRepInvestedNet,
      };

      this.customLogger.log('Final Result:', result);
      return result;
    } else {
      return {
        totalRepEarned,
        totalRepSpent,
        totalRepAvailable: totalRepEarned - totalRepSpent,
        totalRepInvested: 0,
        totalRepInvestedNet: 0,
      };
    }
  }

  public getRepByUser(userId: string, teamId: string): Promise<ReactionByUser[]> {
    return getRepository(Reaction)
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
