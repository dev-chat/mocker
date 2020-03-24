import { IDefinition } from "../../shared/models/define/define-models";
import { DefineService } from "./define.service";

describe("define-utils", () => {
  let defineService: DefineService;

  beforeEach(() => {
    defineService = DefineService.getInstance();
  });

  describe("capitalizeFirstLetter()", () => {
    it("should capitalize the first letter of a given string", () => {
      expect(defineService.capitalizeFirstLetter("test string")).toBe(
        "Test String"
      );
    });
  });

  describe("define()", () => {
    it("should return a promise when attempting to define", () => {
      expect(defineService.define("test")).toBeDefined(); // Firm this up
    });
  });

  describe("formatDefs()", () => {
    it("should return an array of 3 length when no maxDefs parameter is provided", () => {
      expect(defineService.formatDefs(testArray, "test").length).toBe(3);
    });

    it("should return an array of 4 length when a maxDefs parameter of 4 is provided", () => {
      expect(defineService.formatDefs(testArray, "test", 4).length).toBe(4);
    });

    it("should return testArray.length if maxDefs parameter is larger than testArray.length", () => {
      expect(defineService.formatDefs(testArray, "test", 10).length).toBe(5);
    });

    it(`should return [{ "Sorry, no definitions found" }] if defArr === 0`, () => {
      expect(defineService.formatDefs([], "test")[0].text).toBe(
        "Sorry, no definitions found."
      );
    });
  });
});

const testArray: IDefinition[] = [
  {
    definition: "one",
    permalink: "https://urbandictionary.com/whatever",
    thumbs_up: 12,
    author: "jr",
    word: "test",
    defid: 1,
    written_on: "whatever", // ISO Date
    example: "test",
    thumbs_down: 14,
    current_vote: "test",
    sound_urls: ["test"]
  },
  {
    definition: "two",
    permalink: "https://urbandictionary.com/whatever",
    thumbs_up: 12,
    author: "jr",
    word: "test",
    defid: 1,
    written_on: "whatever", // ISO Date
    example: "test",
    thumbs_down: 14,
    current_vote: "test",
    sound_urls: ["test"]
  },
  {
    definition: "three",
    permalink: "https://urbandictionary.com/whatever",
    thumbs_up: 12,
    author: "jr",
    word: "test",
    defid: 1,
    written_on: "whatever", // ISO Date
    example: "test",
    thumbs_down: 14,
    current_vote: "test",
    sound_urls: ["test"]
  },
  {
    definition: "four",
    permalink: "https://urbandictionary.com/whatever",
    thumbs_up: 12,
    author: "jr",
    word: "test",
    defid: 1,
    written_on: "whatever", // ISO Date
    example: "test",
    thumbs_down: 14,
    current_vote: "test",
    sound_urls: ["test"]
  },
  {
    definition: "five",
    permalink: "https://urbandictionary.com/whatever",
    thumbs_up: 12,
    author: "jr",
    word: "test",
    defid: 1,
    written_on: "whatever", // ISO Date
    example: "five",
    thumbs_down: 14,
    current_vote: "test",
    sound_urls: ["test"]
  }
];
