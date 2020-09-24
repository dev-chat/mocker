import Axios, { AxiosResponse } from 'axios';
import { ReactionPersistenceService } from '../reaction/reaction.persistence.service';

export interface PricingData {
  'Global Quote': {
    '01. symbol': string;
    '02. open': string;
    '03. high': string;
    '04. low': string;
    '05. price': string;
    '06. volume': string;
    '07. latest trading day': string;
    '08. previous close': string;
    '09. change': string;
    '10. change percent': string;
  };
}
export class MarketService {
  repService = new ReactionPersistenceService();

  public portfolio(input: string): string {
    return 'test';
  }

  public async buy(ticker: string, qty: number, userId: string, teamId: string) {
    const userRep = await this.repService.getUserRep(userId, teamId);
    const stockPrice = await this.getStockPrice(ticker).catch(e => console.error(e));
    const totalPrice = (stockPrice as number) * qty;
    const canAfford = (userRep as number) >= totalPrice;
    if (canAfford) {
      return this.marketPersistenceService.buy(ticker, stockPrice, userId, teamId);
    } else {
      return "Sorry, you can't afford this.";
    }
  }

  public getStockPrice(ticker: string): Promise<number> {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${process.env.STOCK_API_KEY}`;
    return Axios.get(url).then((pricing: AxiosResponse<PricingData>) => {
      console.log(pricing);
      return +pricing.data['Global Quote']['05. price'];
    });
  }
}
