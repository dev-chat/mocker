import Axios from 'axios';
import { CompanyProfile, MetricResponse, QuoteData, QuoteResponse } from './quote.models';
import { Block, KnownBlock } from '@slack/web-api';
import { WebService } from '../shared/services/web/web.service';
import { logger } from '../shared/logger/logger';

export class QuoteService {
  webService = new WebService();
  logger = logger.child({ module: 'QuoteService' });

  getMarketCap(price: number, sharesOutstanding: number): string {
    const marketCap = (sharesOutstanding * 1000000 * price) / 1000000;
    if (marketCap / 1000000 > 1) {
      return `${(marketCap / 1000000).toFixed(2)}T`;
    } else {
      return `${(marketCap / 1000).toFixed(2)}B`;
    }
  }

  formatData(quote: QuoteResponse, metrics: MetricResponse, companyProfile: CompanyProfile, ticker: string): QuoteData {
    return {
      high: quote?.h?.toFixed(2),
      low: quote?.l?.toFixed(2),
      close: quote?.c?.toFixed(2),
      deltaPercent: quote?.dp?.toFixed(2) + '%',
      delta: quote?.d?.toFixed(2),
      prevClose: quote?.pc?.toFixed(2),
      marketCap: this.getMarketCap(quote?.c, companyProfile?.shareOutstanding),
      lastRefreshed: new Date(),
      '52WeekHigh':
        quote?.h > metrics?.metric?.['52WeekHigh'] ? quote?.h?.toFixed(2) : metrics?.metric?.['52WeekHigh']?.toFixed(2),
      '52WeekLow':
        quote?.l < metrics?.metric?.['52WeekLow'] ? quote?.l?.toFixed(2) : metrics?.metric?.['52WeekLow']?.toFixed(2),
      ticker,
      name: companyProfile?.name || '',
    };
  }

  public quote(ticker: string, channelId: string, userId: string): Promise<void> {
    return Promise.all([this.getQuote(ticker), this.getMetrics(ticker), this.getCompanyProfile(ticker)])
      .then(([quote, metrics, search]) => {
        return this.formatData(quote, metrics, search, ticker);
      })
      .then((quoteData) => {
        this.webService.sendMessage(channelId, '', this.createQuoteBlocks(quoteData, userId)).catch((e) => {
          this.logger.error(e);
          this.webService.sendMessage(
            userId,
            'Sorry, unable to send the requested text to Slack. You have been credited for your Moon Token. Perhaps you were trying to send in a private channel? If so, invite @MoonBeam and try again.',
          );
        });
      })
      .catch((e) => {
        this.logger.error(e);
        this.webService.sendMessage(
          userId,
          'Sorry, something went wrong while fetching the quote. Please try again later.',
        );
      });
  }

  getEmoji(delta: string): string {
    if (parseFloat(delta) > 0) {
      return ':chart_with_upwards_trend:';
    } else if (parseFloat(delta) < 0) {
      return ':chart_with_downwards_trend:';
    }
    return ':chart:';
  }

  getPlusOrMinus(delta: string): string {
    if (parseFloat(delta) > 0) {
      return '+';
    }
    return '';
  }

  getPlusOrMinusPercent(delta: string): string {
    if (parseFloat(delta) > 0) {
      return '+';
    } else {
      return '';
    }
  }

  createQuoteBlocks(quote: QuoteData, userId: string): Block[] | KnownBlock[] | undefined {
    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${quote.ticker.toUpperCase()}  ${quote.name ? `- ${quote.name} ` : ''}${this.getEmoji(quote.delta)}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Latest Price*: $${quote.close}`,
          },
          {
            type: 'mrkdwn',
            text: `*Price Change*: ${this.getPlusOrMinus(quote.delta)}$${quote.delta} (${this.getPlusOrMinusPercent(quote.delta) + quote.deltaPercent})`,
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Previous Close*: $${quote.prevClose}`,
          },
          {
            type: 'mrkdwn',
            text: `*Market Cap*: $${quote.marketCap}`,
          },
          {
            type: 'mrkdwn',
            text: `*Today's High*: $${quote.high}`,
          },
          {
            type: 'mrkdwn',
            text: `*Today's Low*: $${quote.low}`,
          },
          {
            type: 'mrkdwn',
            text: `*52 Week High*: $${quote['52WeekHigh']}`,
          },
          {
            type: 'mrkdwn',
            text: `*52 Week Low*: $${quote['52WeekLow']}`,
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `:moneybag: Quote requested by <@${userId}> :moneybag:`,
            verbatim: false,
          },
        ],
      },
    ];
  }

  getQuote(ticker: string): Promise<QuoteResponse> {
    return Axios.get(
      encodeURI(`https://finnhub.io/api/v1/quote?symbol=${ticker.toUpperCase()}&token=${process.env.FINNHUB_API_KEY}`),
    ).then((response) => response.data);
  }

  getMetrics(ticker: string): Promise<MetricResponse> {
    return Axios.get(
      encodeURI(
        `https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${process.env.FINNHUB_API_KEY}`,
      ),
    ).then((response) => response.data);
  }

  getCompanyProfile(ticker: string): Promise<CompanyProfile> {
    return Axios.get(
      encodeURI(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${process.env.FINNHUB_API_KEY}`),
    ).then((response) => response.data);
  }
}
