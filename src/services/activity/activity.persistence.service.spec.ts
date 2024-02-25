import { ActivityPersistenceService } from './activity.persistence.service';
describe('ActivityPersistenceService', () => {
  let service: ActivityPersistenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mock('../web/web.service');
    jest.mock('getRepository');

    service = new ActivityPersistenceService();
  });

  describe('logActivity', () => {
    it('should log activity', async () => {});

    it('should not log activity when user is not a string', async () => {});
  });
});
