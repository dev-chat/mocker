import { getRepository, InsertResult } from 'typeorm';
import { PortfolioTransactions } from '../shared/db/models/PortfolioTransaction';
import { Portfolio } from '../shared/db/models/Portfolio';
import { SlackUser } from '../shared/db/models/SlackUser';
import { ReactionPersistenceService } from '../reaction/reaction.persistence.service';
import { TotalRep } from '../reaction/reaction.interface';
import Decimal from 'decimal.js';

export interface PortfolioSummaryItem {
  symbol: string;
  quantity: Decimal;
  costBasis?: Decimal;
}

export interface PortfolioSummary {
  transactions: PortfolioTransactions[];
  summary: PortfolioSummaryItem[];
  rep: TotalRep;
}

export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
}

export class PortfolioPersistenceService {
  reactionPersistenceService = new ReactionPersistenceService();

  public async getPortfolio(userId: string, teamId: string): Promise<Portfolio> {
    const userRepo = getRepository(SlackUser);
    const user = await userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.portfolio', 'portfolio')
      .leftJoinAndSelect('portfolio.transactions', 'transactions')
      .where('user.slackId = :userId', { userId })
      .andWhere('user.teamId = :teamId', { teamId })
      .getOne();

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.portfolio) {
      const portfolioRepo = getRepository(Portfolio);
      const portfolio = new Portfolio();
      const savedPortfolio = await portfolioRepo.save(portfolio);

      user.portfolio = savedPortfolio;
      await userRepo.save(user);
      return savedPortfolio;
    }

    return user.portfolio;
  }

  private getLockKey(userId: string, symbol: string): number {
    // Create a deterministic number from userId and symbol
    // Using a simple hash function that should be good enough for our use case
    const str = `${userId}:${symbol}`;
    return Array.from(str).reduce((hash, char) => {
      // Multiply by 31 (common hash multiplier) and add char code
      return (hash << 5) - hash + char.charCodeAt(0);
    }, 0);
  }

  public async transact(
    userId: string,
    teamId: string,
    type: TransactionType,
    stockSymbol: string,
    quantity: number,
    price: number,
  ): Promise<InsertResult> {
    const lockKey = this.getLockKey(userId, stockSymbol);

    // Use transaction to ensure atomicity and automatic lock release
    return await getRepository(PortfolioTransactions).manager.transaction(async (transactionalEntityManager) => {
      // Try to acquire advisory lock
      const lockResult = await transactionalEntityManager.query('SELECT pg_try_advisory_xact_lock($1)', [lockKey]);

      if (!lockResult[0].pg_try_advisory_xact_lock) {
        throw new Error('Another transaction is in progress for this user and symbol. Please try again.');
      }

      const portfolio = await this.getPortfolio(userId, teamId);

      // For SELL transactions, verify sufficient shares within the transaction
      if (type === TransactionType.SELL) {
        const ownedShares = await transactionalEntityManager
          .createQueryBuilder(PortfolioTransactions, 'tx')
          .where('tx.portfolio_id = :portfolioId', { portfolioId: portfolio.id })
          .andWhere('tx.assetSymbol = :symbol', { symbol: stockSymbol })
          .select('SUM(CASE WHEN tx.type = :buyType THEN quantity ELSE -quantity END)', 'netQuantity')
          .setParameter('buyType', TransactionType.BUY)
          .getRawOne()
          .then((result) => Number(result?.netQuantity || 0));

        if (ownedShares < quantity) {
          throw new Error(`Insufficient shares: owns ${ownedShares}, attempting to sell ${quantity}`);
        }
      }

      const transaction = new PortfolioTransactions();
      transaction.portfolio = portfolio;
      transaction.type = type;
      transaction.assetSymbol = stockSymbol;
      transaction.quantity = quantity;
      transaction.price = price;

      return await transactionalEntityManager
        .createQueryBuilder()
        .insert()
        .into(PortfolioTransactions)
        .values(transaction)
        .execute();
    });
  }

  public async getPortfolioSummary(userId: string, teamId: string): Promise<PortfolioSummary> {
    const portfolio = await this.getPortfolio(userId, teamId);

    // Get transactions with explicit query
    const transactions = await getRepository(PortfolioTransactions)
      .createQueryBuilder('tx')
      .where('tx.portfolio_id = :portfolioId', { portfolioId: portfolio.id })
      .orderBy('tx.createdAt', 'ASC')
      .getMany();

    const rep = await this.reactionPersistenceService.getTotalRep(userId, teamId);

    const summary: PortfolioSummary = {
      transactions,
      summary: [],
      rep,
    };

    if (!transactions || transactions.length === 0) {
      return summary;
    }

    const portfolioSummaryItems: PortfolioSummaryItem[] = [];

    transactions.forEach((tx) => {
      const foundItem = portfolioSummaryItems.find((item) => item.symbol === tx.assetSymbol);

      if (!foundItem) {
        const newItem = {
          symbol: tx.assetSymbol,
          quantity: tx.type === 'BUY' ? new Decimal(tx.quantity) : new Decimal(`-${tx.quantity}`),
          costBasis: tx.type === 'BUY' ? new Decimal(tx.quantity).mul(tx.price) : new Decimal(0),
        };
        portfolioSummaryItems.push(newItem);
      } else if (foundItem) {
        if (tx.type === 'BUY') {
          foundItem.quantity = new Decimal(foundItem.quantity).plus(new Decimal(tx.quantity));
          foundItem.costBasis = (foundItem.costBasis || new Decimal(0))
            .plus(new Decimal(tx.quantity))
            .mul(new Decimal(tx.price));
        } else if (tx.type === 'SELL') {
          foundItem.quantity = new Decimal(foundItem.quantity).minus(new Decimal(tx.quantity));
        }
      }
    });

    summary.summary = portfolioSummaryItems.filter((item) => new Decimal(item.quantity).greaterThan(new Decimal(0)));
    return summary;
  }
}
