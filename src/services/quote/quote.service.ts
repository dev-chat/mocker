import Axios from 'axios';
import { CompanyOverviewResponse, QuoteData, QuoteResponse, TimeSeries5MinData } from './quote.models';

export class QuoteService {
  public static getInstance(): QuoteService {
    if (!QuoteService.instance) {
      QuoteService.instance = new QuoteService();
    }
    return QuoteService.instance;
  }
  private static instance: QuoteService;

  formatData(quote: QuoteResponse, company: CompanyOverviewResponse, ticker: string): QuoteData {
    const latestQuote: TimeSeries5MinData = quote['Time Series (5min)'][0];
    const delta =
      (parseFloat(latestQuote['4. close']) - parseFloat(latestQuote['1. open'])) / parseFloat(latestQuote['1. open']);

    return {
      open: parseFloat(latestQuote['1. open']).toFixed(2),
      high: parseFloat(latestQuote['2. high']).toFixed(2),
      low: parseFloat(latestQuote['3. low']).toFixed(2),
      close: parseFloat(latestQuote['4. close']).toFixed(2),
      '52WeekHigh': parseFloat(company['52WeekHigh']).toFixed(2),
      '52WeekLow': parseFloat(company['52WeekLow']).toFixed(2),
      deltaPercent: (delta * 100).toFixed(2) + '%',
      delta,
      marketCap: company['MarketCapitalization'],
      lastRefreshed: quote['Meta Data']['3. Last Refreshed'],
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
      'https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=' +
        ticker +
        '&interval=5min&apikey=' +
        process.env.ALPHA_VANTAGE_API_KEY,
    ).then((response) => response.data);
  }

  getCompanyData(ticker: string): Promise<CompanyOverviewResponse> {
    return Axios.get(
      'https://www.alphavantage.co/query?function=OVERVIEW&symbol=' +
        ticker +
        '&apikey=' +
        process.env.ALPHA_VANTAGE_API_KEY,
    ).then((response) => response.data);
  }
}
