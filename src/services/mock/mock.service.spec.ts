import { MockService } from './mock.service';

describe('MockService', () => {
  let mockService: MockService;
  beforeEach(() => {
    mockService = new MockService();
  });
  describe('mock()', () => {
    it('should mock a users input (single word)', () => {
      expect(mockService.mock('test')).toBe('tEsT');
    });

    it('should mock a users input (sentence)', () => {
      expect(mockService.mock('test sentence with multiple words.')).toBe('tEsT sEnTeNcE wItH mUlTiPlE wOrDs.');
    });

    it('should return input if it is an empty string', () => {
      expect(mockService.mock('')).toBe('');
    });
  });
});
