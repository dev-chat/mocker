import {
  getMsForSpecifiedRange,
  getRemainingTime,
  getTimeString,
  getTimeToMuzzle,
  isRandomEven,
  Timeout,
} from './muzzle-utilities';

describe('muzzle-utilities', () => {
  describe('getTimeString()', () => {
    it('should return 1m30s when 90000ms are passed in', () => {
      expect(getTimeString(90000)).toBe('1m30s');
    });

    it('should return 2m00s when 120000ms is passed in', () => {
      expect(getTimeString(120000)).toBe('2m00s');
    });

    it('should return 2m00s when 120000.123 is passed in', () => {
      expect(getTimeString(120000.123)).toBe('2m00s');
    });

    it('should return 2m00s when 120000.999 is passed in', () => {
      expect(getTimeString(120000.999)).toBe('2m00s');
    });
  });

  describe('getRemainingTime', () => {
    it('should calculate the remaining time correctly', () => {
      const mockTimeout: Timeout = {
        _idleStart: 1000,
        _idleTimeout: 5000,
        hasRef: jest.fn(),
        ref: jest.fn(),
        unref: jest.fn(),
      } as unknown as Timeout;

      jest.spyOn(process, 'uptime').mockReturnValue(2); // Mock process uptime to 2 seconds

      const remainingTime = getRemainingTime(mockTimeout);
      expect(remainingTime).toBe(4000);
    });
  });

  describe('getTimeToMuzzle', () => {
    it('should return a random value between 30 seconds and 3 minutes', () => {
      const time = getTimeToMuzzle();
      expect(time).toBeGreaterThanOrEqual(30000);
      expect(time).toBeLessThanOrEqual(180000);
    });
  });

  describe('getMsForSpecifiedRange', () => {
    it('should return the start value if start and end are the same', () => {
      const result = getMsForSpecifiedRange(5000, 5000);
      expect(result).toBe(5000);
    });

    it('should return a random value between start and end', () => {
      const result = getMsForSpecifiedRange(3000, 5000);
      expect(result).toBeGreaterThanOrEqual(3000);
      expect(result).toBeLessThanOrEqual(5000);
    });
  });

  describe('getTimeString', () => {
    it('should format time correctly as minutes and seconds', () => {
      expect(getTimeString(60000)).toBe('1m00s'); // 1 minute
      expect(getTimeString(61000)).toBe('1m01s'); // 1 minute and 1 second
      expect(getTimeString(119000)).toBe('1m59s'); // 1 minute and 59 seconds
      expect(getTimeString(120000)).toBe('2m00s'); // 2 minutes
    });

    it('should handle edge cases for seconds rounding', () => {
      expect(getTimeString(59999)).toBe('1m00s'); // Just under 1 minute
    });
  });

  describe('isRandomEven', () => {
    it('should return true for even numbers', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.4); // Mock random to return 0.4
      expect(isRandomEven()).toBe(true);
    });

    it('should return false for odd numbers', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.7); // Mock random to return 0.7
      expect(isRandomEven()).toBe(false);
    });
  });
});
