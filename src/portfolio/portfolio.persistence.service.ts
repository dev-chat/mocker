import { getRepository, InsertResult } from 'typeorm';
import { PortfolioTransactions } from '../shared/db/models/PortfolioTransaction';
import { Portfolio } from '../shared/db/models/Portfolio';
import { SlackUser } from '../shared/db/models/SlackUser';
import { ReactionPersistenceService } from '../reaction/reaction.persistence.service';
import { TotalRep } from '../reaction/reaction.interface';
import Decimal from 'decimal.js';
import { logger as loglib } from '../shared/logger/logger';

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
  logger = loglib.child('PortfolioPersistenceService');

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

  private getLockName(userId: string, symbol: string): string {
    // Create a deterministic lock name for this user and symbol combination
    return `portfolio_lock_${userId}_${symbol}`.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  public async transact(
    userId: string,
    teamId: string,
    type: TransactionType,
    stockSymbol: string,
    quantity: number,
    price: number,
  ): Promise<InsertResult> {
    const lockName = this.getLockName(userId, stockSymbol);

    // Use transaction to ensure atomicity and automatic lock release
    return await getRepository(PortfolioTransactions).manager.transaction(async (transactionalEntityManager) => {
      // Try to acquire MySQL named lock with 10 second timeout
      const lockResult = await transactionalEntityManager.query('SELECT GET_LOCK(?, 10)', [lockName]);

      this.logger.info(`Acquired lock result: ${JSON.stringify(lockResult)}`);
      // MySQL GET_LOCK returns 1 if the lock was obtained successfully, 0 if timeout, or NULL if error
      if (!lockResult[0][`'GET_LOCK(${lockName}, 10)'`]) {
        throw new Error('Another transaction is in progress for this user and symbol. Please try again.');
      }

      const portfolio = await this.getPortfolio(userId, teamId);

      try {
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

        const result = await transactionalEntityManager
          .createQueryBuilder()
          .insert()
          .into(PortfolioTransactions)
          .values(transaction)
          .execute();

        // Release the lock explicitly before returning
        await transactionalEntityManager.query('SELECT RELEASE_LOCK(?)', [lockName]);

        return result;
      } catch (error) {
        // Make sure to release the lock in case of error
        await transactionalEntityManager.query('SELECT RELEASE_LOCK(?)', [lockName]);
        throw error;
      }
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
