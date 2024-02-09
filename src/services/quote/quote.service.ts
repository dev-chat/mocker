import Axios from 'axios';
import { CompanyOverviewResponse, QuoteData, QuoteResponse } from './quote.models';

export class QuoteService {
  public static getInstance(): QuoteService {
    if (!QuoteService.instance) {
      QuoteService.instance = new QuoteService();
    }
    return QuoteService.instance;
  }
  private static instance: QuoteService;

  formatData(quote: QuoteResponse, company: CompanyOverviewResponse, ticker: string): QuoteData {
    return {
      open: quote?.o?.toFixed(2),
      high: quote?.h?.toFixed(2),
      low: quote?.l?.toFixed(2),
      close: quote?.c?.toFixed(2),
      deltaPercent: quote?.dp?.toFixed(2) + '%',
      delta: quote?.d?.toFixed(2),
      marketCap: company?.['MarketCapitalization'],
      lastRefreshed: new Date(),
      '52WeekHigh': quote?.h > parseFloat(company['52WeekHigh']) ? quote?.h?.toFixed(2) : company['52WeekHigh'],
      '52WeekLow': quote?.l < parseFloat(company['52WeekLow']) ? quote?.l?.toFixed(2) : company['52WeekLow'],
      ticker,
    };
  }

  public quote(ticker: string): Promise<QuoteData> {
    return Promise.all([this.getQuote(ticker), this.getCompanyData(ticker)]).then(([quote, companyData]) => {
      return this.formatData(quote, companyData, ticker);
    });
  }

  getQuote(ticker: string): Promise<QuoteResponse> {
    return Axios.get(
      encodeURI(`https://finnhub.io/api/v1/quote?symbol=${ticker.toUpperCase()}&token=${process.env.FINNHUB_API_KEY}`),
    ).then((response) => {
      console.log(response.data);
      return response.data;
    });
  }

  getCompanyData(ticker: string): Promise<CompanyOverviewResponse> {
    return Axios.get(
      encodeURI(
        'https://www.alphavantage.co/query?function=OVERVIEW&symbol=' +
          ticker +
          '&apikey=' +
          process.env.ALPHA_VANTAGE_API_KEY,
      ),
    ).then((response) => response.data);
  }
}
