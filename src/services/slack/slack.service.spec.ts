import { SlackService } from "./slack.service";

describe("slack-utils", () => {
  let slackService: SlackService;

  beforeEach(() => {
    slackService = new SlackService();
  });
  describe("getUserId()", () => {
    it("should return a userId when one is passed in without a username", () => {
      expect(slackService.getUserId("<@U2TYNKJ>")).toBe("U2TYNKJ");
    });

    it("should return a userId when one is passed in with a username with spaces", () => {
      expect(slackService.getUserId("<@U2TYNKJ | jrjrjr>")).toBe("U2TYNKJ");
    });

    it("should return a userId when one is passed in with a username without spaces", () => {
      expect(slackService.getUserId("<@U2TYNKJ|jrjrjr>")).toBe("U2TYNKJ");
    });

    it("should return '' when no userId exists", () => {
      expect(slackService.getUserId("total waste of time")).toBe("");
    });
  });

  describe("containsTag()", () => {
    it("should return false if a word has @ in it and is not a tag", () => {
      const testWord = ".@channel";
      expect(slackService.containsTag(testWord)).toBe(false);
    });

    it("should return false if a word does not include @", () => {
      const testWord = "test";
      expect(slackService.containsTag(testWord)).toBe(false);
    });

    it("should return true if a word has <!channel> in it", () => {
      const testWord = "<!channel>";
      expect(slackService.containsTag(testWord)).toBe(true);
    });

    it("should return true if a word has <!here> in it", () => {
      const testWord = "<!here>";
      expect(slackService.containsTag(testWord)).toBe(true);
    });

    it("should return true if a word has a tagged user", () => {
      const testUser = "<@UTJFJKL>";
      expect(slackService.containsTag(testUser)).toBe(true);
    });
  });
});
