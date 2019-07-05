import { containsTag, getUserId } from "./slack-utils";

describe("slack-utils", () => {
  describe("getUserId()", () => {
    it("should return a userId when one is passed in without a username", () => {
      expect(getUserId("<@U2TYNKJ>")).toBe("U2TYNKJ");
    });

    it("should return a userId when one is passed in with a username with spaces", () => {
      expect(getUserId("<@U2TYNKJ | jrjrjr>")).toBe("U2TYNKJ");
    });

    it("should return a userId when one is passed in with a username without spaces", () => {
      expect(getUserId("<@U2TYNKJ|jrjrjr>")).toBe("U2TYNKJ");
    });

    it("should return '' when no userId exists", () => {
      expect(getUserId("total waste of time")).toBe("");
    });
  });

  describe("containsTag()", () => {
    it("should return false if a word has @ in it and is not a tag", () => {
      const testWord = ".@channel";
      expect(containsTag(testWord)).toBe(false);
    });

    it("should return false if a word does not include @", () => {
      const testWord = "test";
      expect(containsTag(testWord)).toBe(false);
    });

    it("should return true if a word has <!channel> in it", () => {
      const testWord = "<!channel>";
      expect(containsTag(testWord)).toBe(true);
    });

    it("should return true if a word has <!here> in it", () => {
      const testWord = "<!here>";
      expect(containsTag(testWord)).toBe(true);
    });

    it("should return true if a word has a tagged user", () => {
      const testUser = "<@UTJFJKL>";
      expect(containsTag(testUser)).toBe(true);
    });
  });
});
