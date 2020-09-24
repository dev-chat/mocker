import { getRepository } from 'typeorm';

export class MarketPersistenceService {
  public static getInstance(): MarketPersistenceService {
    if (!MarketPersistenceService.instance) {
      MarketPersistenceService.instance = new MarketPersistenceService();
    }
    return MarketPersistenceService.instance;
  }

  private static instance: MarketPersistenceService;
}
