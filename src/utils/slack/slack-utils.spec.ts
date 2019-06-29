import { expect } from "chai";
import { getUserId } from "./slack-utils";

describe("slack-utils", () => {
  describe("getUserId()", () => {
    it("should return a userId when one is passed in without a username", () => {
      expect(getUserId("<@U2TYNKJ>")).to.equal("U2TYNKJ");
    });

    it("should return a userId when one is passed in with a username with spaces", () => {
      expect(getUserId("<@U2TYNKJ | jrjrjr>")).to.equal("U2TYNKJ");
    });

    it("should return a userId when one is passed in with a username without spaces", () => {
      expect(getUserId("<@U2TYNKJ|jrjrjr>")).to.equal("U2TYNKJ");
    });

    it("should return an empty string when no userId exists", () => {
      expect(getUserId("total waste of time")).to.equal("");
    });
  });
});
