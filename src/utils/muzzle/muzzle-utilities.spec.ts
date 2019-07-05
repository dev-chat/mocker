import { expect } from "chai";
import { getTimeString, getTimeToMuzzle } from "./muzzle-utilities";

describe("muzzle-utilities", () => {
  describe("getTimeToMuzzle", () => {
    it("should return a value greater than 0 and less than 180000", () => {
      expect(getTimeToMuzzle()).to.be.greaterThan(0);
      expect(getTimeToMuzzle()).to.be.lessThan(180000);
    });
  });

  describe("getTimeString", () => {
    it("should return 1m30s when 90000ms are passed in", () => {
      expect(getTimeString(90000)).to.equal("1m30s");
    });

    it("should return 2m00s when 120000ms is passed in", () => {
      expect(getTimeString(120000)).to.equal("2m00s");
    });
  });
});
