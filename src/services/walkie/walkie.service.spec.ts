import { WalkieService } from "./walkie.service";

describe("slack-utils", () => {
  let walkieService: WalkieService;

  beforeEach(() => {
    walkieService = new WalkieService();
  });

  describe("walkieTalkie", () => {
    it("convert a user id to NATO alphabet", () => {
      const talked = walkieService.walkieTalkie(
        "This this <@U2ZCMGB52 | whoever> test test"
      );
      expect(talked).toBe(
        `:walkietalkie: *chk* This this Juliet Foxtrot (<@U2ZCMGB52 | whoever>) test test over. *chk* :walkietalkie:`
      );
    });
  });
});
