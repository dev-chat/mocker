import { getTimeString, getTimeToMuzzle } from "./muzzle-utilities";

describe("muzzle-utilities", () => {
  describe("getTimeToMuzzle()", () => {
    it("should return a value greater than 0 and less than 180000", () => {
      expect(getTimeToMuzzle()).toBeGreaterThan(0);
      expect(getTimeToMuzzle()).toBeLessThan(180000);
    });
  });

  describe("getTimeString()", () => {
    it("should return 1m30s when 90000ms are passed in", () => {
      expect(getTimeString(90000)).toBe("1m30s");
    });

    it("should return 2m00s when 120000ms is passed in", () => {
      expect(getTimeString(120000)).toBe("2m00s");
    });

    it("should return 2m00s when 120000.123 is passed in", () => {
      expect(getTimeString(120000.123)).toBe("2m00s");
    });

    it("should return 2m00s when 120000.999 is passed in", () => {
      expect(getTimeString(120000.999)).toBe("2m00s");
    });
  });
});
