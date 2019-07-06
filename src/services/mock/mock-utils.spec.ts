import { mock } from "./mock-utils";

describe("mock-utils", () => {
  describe("mock()", () => {
    it("should mock a users input (single word)", () => {
      expect(mock("test")).toBe("tEsT");
    });

    it("should mock a users input (sentence)", () => {
      expect(mock("test sentence with multiple words.")).toBe(
        "tEsT sEnTeNcE wItH mUlTiPlE wOrDs."
      );
    });

    it("should return input if it is an empty string", () => {
      expect(mock("")).toBe("");
    });
  });
});
