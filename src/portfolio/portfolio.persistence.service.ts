import { getRepository, InsertResult } from 'typeorm';
import { PortfolioTransactions } from '../shared/db/models/PortfolioTransaction';
import { Portfolio } from '../shared/db/models/Portfolio';
import { SlackUser } from '../shared/db/models/SlackUser';

export interface PortfolioSummaryItem {
  symbol: string;
  quantity: number;
  costBasis?: number;
}

export interface PortfolioSummary {
  transactions: PortfolioTransactions[];
  summary: PortfolioSummaryItem[];
}

export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
}

export class PortfolioPersistenceService {
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

  public async transact(
    userId: string,
    teamId: string,
    type: TransactionType,
    stockSymbol: string,
    quantity: number,
    price: number,
  ): Promise<InsertResult> {
    const portfolio = await this.getPortfolio(userId, teamId);

    const txRepo = getRepository(PortfolioTransactions);
    const transaction = new PortfolioTransactions();
    transaction.portfolio = portfolio;
    transaction.type = type;
    transaction.assetSymbol = stockSymbol;
    transaction.quantity = quantity;
    transaction.price = price;

    return txRepo.createQueryBuilder().insert().into(PortfolioTransactions).values(transaction).execute();
  }

  public async getPortfolioSummary(userId: string, teamId: string): Promise<PortfolioSummary> {
    const portfolio = await this.getPortfolio(userId, teamId);

    // Get transactions with explicit query
    const transactions = await getRepository(PortfolioTransactions)
      .createQueryBuilder('tx')
      .where('tx.portfolio_id = :portfolioId', { portfolioId: portfolio.id })
      .orderBy('tx.createdAt', 'ASC')
      .getMany();

    const summary: PortfolioSummary = {
      transactions,
      summary: [],
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
          quantity: tx.type === 'BUY' ? tx.quantity : -tx.quantity,
          costBasis: tx.type === 'BUY' ? tx.quantity * tx.price : 0,
        };
        portfolioSummaryItems.push(newItem);
      } else if (foundItem) {
        if (tx.type === 'BUY') {
          foundItem.quantity += tx.quantity;
          foundItem.costBasis = (foundItem.costBasis || 0) + tx.quantity * tx.price;
        } else if (tx.type === 'SELL') {
          foundItem.quantity -= tx.quantity;
        }
      }
    });

    summary.summary = portfolioSummaryItems;
    return summary;
  }
}
