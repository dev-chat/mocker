import { logger } from '../shared/logger/logger';
import { SearchPersistenceService, SearchFilters, SearchResults } from './search.persistence.service';
import { SlackUser } from '../shared/db/models/SlackUser';
import { SlackChannel } from '../shared/db/models/SlackChannel';

const serviceLogger = logger.child({ module: 'SearchService' });

export interface SearchMessagesParams {
  teamId: string;
  query?: string;
  userId?: string;
  channelId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class SearchService {
  private persistenceService = new SearchPersistenceService();

  async searchMessages(params: SearchMessagesParams): Promise<SearchResults> {
    serviceLogger.debug('Searching messages with params:', params);

    const filters: SearchFilters = {
      teamId: params.teamId,
      query: params.query,
      userId: params.userId ? parseInt(params.userId, 10) : undefined,
      channelId: params.channelId,
      startDate: params.startDate ? new Date(params.startDate) : undefined,
      endDate: params.endDate ? new Date(params.endDate) : undefined,
      limit: params.limit ? Math.min(Math.max(1, params.limit), 100) : 20,
      offset: params.offset ? Math.max(0, params.offset) : 0,
    };

    if (filters.startDate && isNaN(filters.startDate.getTime())) {
      throw new Error('Invalid startDate format');
    }

    if (filters.endDate && isNaN(filters.endDate.getTime())) {
      throw new Error('Invalid endDate format');
    }

    return this.persistenceService.searchMessages(filters);
  }

  async getUsers(teamId: string): Promise<Pick<SlackUser, 'id' | 'slackId' | 'name'>[]> {
    serviceLogger.debug('Getting users for team:', teamId);
    return this.persistenceService.getUsers(teamId);
  }

  async getChannels(teamId: string): Promise<Pick<SlackChannel, 'id' | 'channelId' | 'name'>[]> {
    serviceLogger.debug('Getting channels for team:', teamId);
    return this.persistenceService.getChannels(teamId);
  }
}
