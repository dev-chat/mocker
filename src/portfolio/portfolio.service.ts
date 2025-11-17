import Decimal from 'decimal.js';
import { QuoteResponse } from '../quote/quote.models';
import { QuoteService } from '../quote/quote.service';
import { ReactionPersistenceService } from '../reaction/reaction.persistence.service';
import {
  PortfolioPersistenceService,
  PortfolioSummary,
  PortfolioSummaryItem,
  TransactionType,
} from './portfolio.persistence.service';
import { logger } from '../shared/logger/logger';

export enum MessageHandlerEnum {
  PRIVATE = 'PRIVATE',
  PUBLIC = 'PUBLIC',
}

interface MessageHandler {
  message: string;
  classification: MessageHandlerEnum;
}

interface PortfolioSummaryWithQuotes extends PortfolioSummary {
  summary: PortfolioSummaryWithQuotesItem[];
}

interface PortfolioSummaryWithQuotesItem extends PortfolioSummaryItem {
  currentPrice: Decimal;
}

interface QuoteWithTicker extends QuoteResponse {
  ticker: string;
}

export class PortfolioService {
  quoteService = new QuoteService();
  repPersistenceService = new ReactionPersistenceService();
  portfolioPersistenceService = new PortfolioPersistenceService();
  logger = logger.child('PortfolioService');

  public getQuotesWithTicker(portfolioSummaryItem: PortfolioSummaryItem[]): Promise<QuoteWithTicker[]> {
    return Promise.all(
      portfolioSummaryItem.map((item) =>
        this.quoteService.getQuote(item.symbol).then((quote) => ({ ...quote, ticker: item.symbol }) as QuoteWithTicker),
      ),
    );
  }

  public getPortfolioSummaryWithQuotes(userId: string, teamId: string): Promise<PortfolioSummaryWithQuotes> {
    return this.portfolioPersistenceService.getPortfolioSummary(userId, teamId).then((summary) => {
      return this.getQuotesWithTicker(summary.summary).then((quotes) => {
        const summaryWithQuotes: PortfolioSummaryWithQuotesItem[] = summary.summary.map((item) => {
          const price = quotes.find((q) => q && q.ticker === item.symbol)?.c || 0;
          this.logger.info(`Quote for ${item.symbol}: ${price}`);
          this.logger.info(JSON.stringify({ ...item, currentPrice: new Decimal(price) }));
          return {
            ...item,
            currentPrice: new Decimal(price),
          };
        });
        return {
          transactions: summary.transactions,
          summary: summaryWithQuotes,
          rep: summary.rep,
        };
      });
    });
  }

  private isInDST(date: Date): boolean {
    // US DST starts on second Sunday in March and ends on first Sunday in November
    const year = date.getFullYear();
    const dstStart = new Date(year, 2, 14 - new Date(year, 2, 1).getDay(), 2); // 2nd Sunday March 2AM
    const dstEnd = new Date(year, 10, 7 - new Date(year, 10, 1).getDay(), 2); // 1st Sunday Nov 2AM

    return date >= dstStart && date < dstEnd;
  }

  public isTradingHours(): boolean {
    // Assuming machine is in UTC, use UTC methods
    const now = new Date();
    const day = now.getUTCDay();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();

    // First check if it's a weekday (Monday = 1, Friday = 5)
    if (day < 1 || day > 5) {
      return false;
    }

    // Convert UTC to Eastern Time
    // Market hours: 9:30 AM - 4:00 PM ET
    // EDT (UTC-4): 13:30 - 20:00 UTC
    // EST (UTC-5): 14:30 - 21:00 UTC
    const isDST = this.isInDST(now);

    // Define market hours in UTC
    const marketOpen = {
      hour: isDST ? 13 : 14,
      minute: 30,
    };

    const marketClose = {
      hour: isDST ? 20 : 21,
      minute: 0,
    };

    // Check if current UTC time is within market hours
    if (utcHours < marketOpen.hour || utcHours > marketClose.hour) {
      return false;
    }

    if (utcHours === marketOpen.hour && utcMinutes < marketOpen.minute) {
      return false;
    }

    if (utcHours === marketClose.hour && utcMinutes > marketClose.minute) {
      return false;
    }

    return true;
  }

  public async transact(
    userId: string,
    teamId: string,
    stockSymbol: string,
    quantity: number,
    action: TransactionType,
  ): Promise<MessageHandler> {
    if (typeof stockSymbol !== 'string') {
      return {
        message: 'Stock symbol must be a string. Transaction aborted.',
        classification: MessageHandlerEnum.PRIVATE,
      };
    }

    if (typeof quantity !== 'number' || isNaN(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
      return {
        message: `Invalid quantity: \`${quantity}\`. Quantity must be a positive integer. Transaction aborted.`,
        classification: MessageHandlerEnum.PRIVATE,
      };
    }

    if (!this.isTradingHours()) {
      return {
        message:
          'Transactions can only be made during trading hours (Monday to Friday, 9:30 AM to 4:00 PM EST). Transaction aborted.',
        classification: MessageHandlerEnum.PRIVATE,
      };
    }

    if (!quantity || quantity <= 0) {
      return {
        message: `Invalid quantity: \`${quantity}\`. Quantity must be a positive integer. Transaction aborted.`,
        classification: MessageHandlerEnum.PRIVATE,
      };
    }

    if (!stockSymbol || stockSymbol.trim() === '') {
      return {
        message: 'Stock symbol cannot be empty. Transaction aborted.',
        classification: MessageHandlerEnum.PRIVATE,
      };
    }

    let price: number;

    try {
      const { c } = await this.quoteService.getQuote(stockSymbol);
      price = c;
    } catch (e) {
      return {
        message: `Unable to retrieve price for \`${stockSymbol}\`. Transaction aborted.`,
        classification: MessageHandlerEnum.PRIVATE,
      };
    }

    if (action === TransactionType.BUY) {
      const { totalRepAvailable } = await this.repPersistenceService.getTotalRep(userId, teamId);
      const totalCost = price * quantity;
      if (totalRepAvailable < totalCost) {
        return {
          message: `Insufficient rep to complete purchase of \`${quantity}\` shares of \`${stockSymbol}\`. You only have \`${totalRepAvailable}\` rep available.`,
          classification: MessageHandlerEnum.PRIVATE,
        };
      } else if (!price) {
        return {
          message: `Unable to retrieve price for \`${stockSymbol}\`. Transaction aborted.`,
          classification: MessageHandlerEnum.PRIVATE,
        };
      } else {
        return this.portfolioPersistenceService
          .transact(userId, teamId, action, stockSymbol, quantity, price)
          .then(() => {
            return {
              message: `:moneybag: <@${userId}> has successfully purchased \`${quantity}\` shares of \`${stockSymbol}\` at \`$${price.toFixed(2)}\` per share. Total cost: \`$${totalCost.toFixed(2)}\`. :moneybag:`,
              classification: MessageHandlerEnum.PUBLIC,
            };
          })
          .catch((e) => {
            return {
              message: `Transaction failed due to an error: ${e.message}`,
              classification: MessageHandlerEnum.PRIVATE,
            };
          });
      }
    } else if (action === TransactionType.SELL) {
      const portfolio = await this.portfolioPersistenceService.getPortfolioSummary(userId, teamId);

      let ownedShares = 0;
      let costBasis = 0;
      if (portfolio.transactions) {
        ownedShares = portfolio.transactions
          .filter((tx) => tx.assetSymbol === stockSymbol)
          .reduce((total, tx) => {
            if (tx.type === TransactionType.BUY) {
              return total + tx.quantity;
            } else if (tx.type === TransactionType.SELL) {
              return total - tx.quantity;
            }
            return total;
          }, 0);

        costBasis = portfolio.transactions
          .filter((tx) => tx.assetSymbol === stockSymbol)
          .reduce((total, tx) => {
            if (tx.type === TransactionType.BUY) {
              return total + tx.quantity * tx.price;
            } else if (tx.type === TransactionType.SELL) {
              return total - tx.quantity * (total / ownedShares); // Average cost basis reduction
            }
            return total;
          }, 0);
      }

      if (ownedShares < quantity) {
        return {
          message: `Insufficient shares to complete sale of \`${quantity}\` shares of \`${stockSymbol}\`. You only own \`${ownedShares}\` shares.`,
          classification: MessageHandlerEnum.PRIVATE,
        };
      } else if (!price) {
        return {
          message: `Unable to retrieve price for \`${stockSymbol}\`. Transaction aborted.`,
          classification: MessageHandlerEnum.PRIVATE,
        };
      } else {
        return this.portfolioPersistenceService
          .transact(userId, teamId, action, stockSymbol, quantity, price)
          .then(() => {
            const totalProceeds = price * quantity;
            const totalGainLoss = totalProceeds - costBasis;
            const emoji = totalGainLoss > 0 ? ':chart_with_upwards_trend:' : ':chart_with_downwards_trend:';
            return {
              message: `${emoji} <@${userId}> has successfully sold \`${quantity}\` shares of \`${stockSymbol}\` at \`$${price.toFixed(2)}\` per share for a ${totalGainLoss > 0 ? 'gain' : 'loss'} of $${totalGainLoss}. Total proceeds: \`$${totalProceeds.toFixed(2)}\`. ${emoji}`,
              classification: MessageHandlerEnum.PUBLIC,
            };
          })
          .catch((e) => {
            return {
              message: `Transaction failed due to an error: ${e.message}`,
              classification: MessageHandlerEnum.PRIVATE,
            };
          });
      }
    } else {
      return {
        message: `Invalid transaction type: ${action}. Transaction aborted.`,
        classification: MessageHandlerEnum.PRIVATE,
      };
    }
  }
}
