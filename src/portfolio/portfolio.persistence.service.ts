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
  public getPortfolio(userId: string, teamId: string): Promise<Portfolio> {
    return getRepository(SlackUser)
      .findOne({ where: { slackId: userId, teamId }, relations: ['portfolio'] })
      .then((user) => {
        if (!user) {
          throw new Error('User not found');
        } else if (!user.portfolio) {
          const portfolio = new Portfolio();
          portfolio.userId = user;
          return getRepository(Portfolio)
            .save(portfolio)
            .then((savedPortfolio) => {
              user.portfolio = savedPortfolio;
              return getRepository(SlackUser)
                .save(user)
                .then(() => savedPortfolio);
            });
        }
        return user?.portfolio as Portfolio;
      });
  }

  public transact(
    userId: string,
    teamId: string,
    type: TransactionType,
    stockSymbol: string,
    quantity: number,
    price: number,
  ): Promise<InsertResult> {
    return this.getPortfolio(userId, teamId).then((portfolio) => {
      const transaction = new PortfolioTransactions();
      transaction.portfolioId = portfolio;
      transaction.type = type;
      transaction.assetSymbol = stockSymbol;
      transaction.quantity = quantity;
      transaction.price = price;
      return getRepository(PortfolioTransactions).insert(transaction);
    });
  }

  public getPortfolioSummary(userId: string, teamId: string): Promise<PortfolioSummary> {
    return this.getPortfolio(userId, teamId).then((portfolio) => {
      const summary: PortfolioSummary = {
        transactions: portfolio?.transactions || [],
        summary: [],
      };

      if (!portfolio?.transactions) {
        return summary;
      }

      const { transactions } = portfolio;
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

      return summary;
    });
  }
}
