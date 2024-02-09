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

  formatData(quote: QuoteResponse, company: CompanyOverviewResponse): QuoteData {
    const latestQuote: TimeSeries5MinData = quote['Time Series (5min)'][0];

    return {
      open: latestQuote['1. open'],
      high: latestQuote['2. high'],
      low: latestQuote['3. low'],
      close: latestQuote['4. close'],
      '52WeekHigh': company['52WeekHigh'],
      '52WeekLow': company['52WeekLow'],
      delta:
        (
          ((parseInt(latestQuote['4. close']) - parseInt(latestQuote['1. open'])) / parseInt(latestQuote['1. open'])) *
          100
        ).toFixed(2) + '%',
      marketCap: company['MarketCapitalization'],
      lastRefreshed: quote['Meta Data']['3. Last Refreshed'],
    };
  }

  public quote(ticker: string): Promise<QuoteData> {
    return Promise.all([this.getQuote(ticker), this.getCompanyData(ticker)]).then(([quote, companyData]) => {
      return this.formatData(quote, companyData);
    });
  }

  getQuote(ticker: string): Promise<QuoteResponse> {
    return Axios.get(
      'https://www.alphavantage.com/query?function=TIME_SERIES_INTRADAY&symbol=' +
        ticker +
        '&interval=5min&apikey=' +
        process.env.ALPHA_VANTAGE_API_KEY,
    ).then((response) => response.data);
  }

  getCompanyData(ticker: string): Promise<CompanyOverviewResponse> {
    return Axios.get(
      'https://www.alphavantage.com/query?function=OVERVIEW&symbol=' +
        ticker +
        '&apikey=' +
        process.env.ALPHA_VANTAGE_API_KEY,
    ).then((response) => response.data);
  }
}
