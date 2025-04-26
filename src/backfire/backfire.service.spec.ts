import { BackfireService } from './backfire.service';

describe('BackfireService', () => {
  let backfireService: BackfireService;

  beforeEach(() => {
    backfireService = new BackfireService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runAllTimers();
  });

  it('should create', () => {
    expect(backfireService).toBeTruthy();
  });
});
