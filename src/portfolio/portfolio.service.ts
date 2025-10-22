import { QuoteResponse } from '../quote/quote.models';
import { QuoteService } from '../quote/quote.service';
import { ReactionPersistenceService } from '../reaction/reaction.persistence.service';
import {
  PortfolioPersistenceService,
  PortfolioSummary,
  PortfolioSummaryItem,
  TransactionType,
} from './portfolio.persistence.service';

export enum MessageHandlerEnum {
  PRIVATE = 'PRIVATE',
  PUBLIC = 'PUBLIC',
}

interface MessageHandler {
  message: string;
  classification: MessageHandlerEnum;
}

interface PortfolioSummaryWithQuotes extends PortfolioSummary {
  summary: (PortfolioSummaryItem & { currentPrice: number })[];
}

interface QuoteWithTicker extends QuoteResponse {
  ticker: string;
}

export class PortfolioService {
  quoteService = new QuoteService();
  repPersistenceService = new ReactionPersistenceService();
  portfolioPersistenceService = new PortfolioPersistenceService();

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
        const summaryWithQuotes: (PortfolioSummaryItem & { currentPrice: number })[] = summary.summary.map((item) => ({
          ...item,
          currentPrice: quotes.find((q) => q && q.ticker === item.symbol)?.c || 0,
        }));
        return {
          transactions: summary.transactions,
          summary: summaryWithQuotes,
        };
      });
    });
  }

  public async transact(
    userId: string,
    teamId: string,
    stockSymbol: string,
    quantity: number,
    action: TransactionType,
  ): Promise<MessageHandler> {
    const { c: price } = await this.quoteService.getQuote(stockSymbol);

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
              message: `<@${userId}> has successfully purchased \`${quantity}\` shares of \`${stockSymbol}\` at \`$${price.toFixed(2)}\` per share. Total cost: \`$${totalCost.toFixed(2)}\`.`,
              classification: MessageHandlerEnum.PUBLIC,
            };
          });
      }
    } else if (action === TransactionType.SELL) {
      const ownedShares = await this.portfolioPersistenceService.getPortfolioSummary(userId, teamId).then((summary) => {
        const item = summary.summary.find((s) => s.symbol === stockSymbol);
        return item ? item.quantity : 0;
      });

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
            return {
              message: `<@${userId}> has successfully sold \`${quantity}\` shares of \`${stockSymbol}\` at \`$${price.toFixed(2)}\` per share. Total proceeds: \`$${totalProceeds.toFixed(2)}\`.`,
              classification: MessageHandlerEnum.PUBLIC,
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
