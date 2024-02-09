import Axios from 'axios';
import { CompanyProfile, MetricResponse, QuoteData, QuoteResponse } from './quote.models';

export class QuoteService {
  public static getInstance(): QuoteService {
    if (!QuoteService.instance) {
      QuoteService.instance = new QuoteService();
    }
    return QuoteService.instance;
  }
  private static instance: QuoteService;

  formatData(quote: QuoteResponse, metrics: MetricResponse, companyProfile: CompanyProfile, ticker: string): QuoteData {
    return {
      high: quote?.h?.toFixed(2),
      low: quote?.l?.toFixed(2),
      close: quote?.c?.toFixed(2),
      deltaPercent: quote?.dp?.toFixed(2) + '%',
      delta: quote?.d?.toFixed(2),
      prevClose: quote?.pc?.toFixed(2),
      marketCap: (companyProfile?.shareOutstanding * quote?.c) / 1000000,
      lastRefreshed: new Date(),
      '52WeekHigh':
        quote?.h > metrics?.metric?.['52WeekHigh'] ? quote?.h?.toFixed(2) : metrics?.metric?.['52WeekHigh']?.toFixed(2),
      '52WeekLow':
        quote?.l < metrics?.metric?.['52WeekLow'] ? quote?.l?.toFixed(2) : metrics?.metric?.['52WeekLow']?.toFixed(2),
      ticker,
      name: companyProfile?.name || '',
    };
  }

  public quote(ticker: string): Promise<QuoteData> {
    return Promise.all([this.getQuote(ticker), this.getMetrics(ticker), this.getCompanyProfile(ticker)]).then(
      ([quote, metrics, search]) => {
        return this.formatData(quote, metrics, search, ticker);
      },
    );
  }

  getQuote(ticker: string): Promise<QuoteResponse> {
    return Axios.get(
      encodeURI(`https://finnhub.io/api/v1/quote?symbol=${ticker.toUpperCase()}&token=${process.env.FINNHUB_API_KEY}`),
    ).then((response) => {
      console.log(response.data);
      return response.data;
    });
  }

  getMetrics(ticker: string): Promise<MetricResponse> {
    return Axios.get(
      encodeURI(
        `https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${process.env.FINNHUB_API_KEY}`,
      ),
    ).then((response) => {
      console.log(response.data);
      return response.data;
    });
  }

  getCompanyProfile(ticker: string): Promise<CompanyProfile> {
    return Axios.get(
      encodeURI(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${process.env.FINNHUB_API_KEY}`),
    ).then((response) => {
      console.log(response.data);
      return response.data;
    });
  }
}
