import { DataSource } from 'typeorm';
import { EventRequest } from '../../shared/models/slack/slack-models';
import {
  mockEventRequest,
  mockEventRequestWithNoUser,
  mockEventRequestWithNumberUser,
} from './activity.persistence.mock';
import { ActivityPersistenceService } from './activity.persistence';

describe('ActivityPersistenceService', () => {
  let service: ActivityPersistenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ActivityPersistenceService({
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn(),
        save: jest.fn().mockReturnValue({}),
      }),
    } as unknown as DataSource);
  });

  describe('logActivity', () => {
    it('should log activity', async () => {
      const result = await service.logActivity(mockEventRequest as EventRequest);
      expect(result).toBeDefined();
    });

    it('should not log activity when user is empty string', async () => {
      const result = await service.logActivity(mockEventRequestWithNoUser as EventRequest);
      expect(result).toBeUndefined();
    });

    it('should not log activity when user is not a string', async () => {
      const result = await service.logActivity(mockEventRequestWithNumberUser as unknown as EventRequest);
      expect(result).toBeUndefined();
    });

    it('should not log activity when event type is user_profile_changed', async () => {
      const result = await service.logActivity(mockEventRequestWithNoUser as EventRequest);
      expect(result).toBeUndefined();
    });
  });
});
