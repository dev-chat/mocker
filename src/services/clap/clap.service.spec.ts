import { ClapService } from "./clap.service";

describe("ClapService", () => {
  let clapService: ClapService;

  beforeEach(() => {
    clapService = new ClapService();
  });

  describe("clap()", () => {
    it("should clap a users input with multiple words", () => {
      expect(clapService.clap("test this out")).toBe(
        "test :clap: this :clap: out :clap:"
      );
    });

    it("should return input if it is an empty string", () => {
      expect(clapService.clap("")).toBe("");
    });
  });
});
