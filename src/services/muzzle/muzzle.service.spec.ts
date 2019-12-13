import { UpdateResult } from "typeorm";
import { Muzzle } from "../../shared/db/models/Muzzle";
import {
  IEventRequest,
  ISlackUser
} from "../../shared/models/slack/slack-models";
import { SlackService } from "../slack/slack.service";
import * as muzzleUtils from "./muzzle-utilities";
import { MuzzlePersistenceService } from "./muzzle.persistence.service";
import { MuzzleService } from "./muzzle.service";

describe("MuzzleService", () => {
  const testData = {
    user: "123",
    user2: "456",
    user3: "789",
    requestor: "666"
  };

  let muzzleService: MuzzleService;
  let slackInstance: SlackService;

  beforeEach(() => {
    muzzleService = new MuzzleService();
    slackInstance = SlackService.getInstance();
    slackInstance.userList = [
      { id: "123", name: "test123" },
      { id: "456", name: "test456" },
      { id: "789", name: "test789" },
      { id: "666", name: "requestor" }
    ] as ISlackUser[];
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runAllTimers();
  });

  describe("muzzle()", () => {
    beforeEach(() => {
      const mockResolve = { raw: "whatever" };
      jest
        .spyOn(
          MuzzlePersistenceService.getInstance(),
          "incrementMessageSuppressions"
        )
        .mockResolvedValue(mockResolve as UpdateResult);
      jest
        .spyOn(
          MuzzlePersistenceService.getInstance(),
          "incrementCharacterSuppressions"
        )
        .mockResolvedValue(mockResolve as UpdateResult);
      jest
        .spyOn(
          MuzzlePersistenceService.getInstance(),
          "incrementWordSuppressions"
        )
        .mockResolvedValue(mockResolve as UpdateResult);
    });

    it("should always muzzle a tagged user", () => {
      const testSentence =
        "<@U2TKJ> <@JKDSF> <@SDGJSK> <@LSKJDSG> <@lkjdsa> <@LKSJDF> <@SDLJG> <@jrjrjr> <@fudka>";
      expect(muzzleService.muzzle(testSentence, 1, false)).toBe(
        " ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm.. "
      );
    });

    it("should always muzzle <!channel>", () => {
      const testSentence = "<!channel>";
      expect(muzzleService.muzzle(testSentence, 1, false)).toBe(" ..mMm.. ");
    });

    it("should always muzzle <!here>", () => {
      const testSentence = "<!here>";
      expect(muzzleService.muzzle(testSentence, 1, false)).toBe(" ..mMm.. ");
    });

    it("should always muzzle a word with length > 10", () => {
      const testSentence = "this.is.a.way.to.game.the.system";
      expect(muzzleService.muzzle(testSentence, 1, false)).toBe(" ..mMm.. ");
    });
  });

  describe("shouldBotMessageBeMuzzled()", () => {
    let mockRequest: IEventRequest;
    beforeEach(() => {
      /* tslint:disable-next-line:no-object-literal-type-assertion */
      mockRequest = {
        event: {
          subtype: "bot_message",
          username: "not_muzzle",
          text: "<@123>",
          attachments: [
            {
              callback_id: "LKJSF_123",
              pretext: "<@123>",
              text: "<@123>"
            }
          ]
        }
      } as IEventRequest;
    });

    describe("when a user is muzzled", () => {
      beforeEach(async () => {
        const mockMuzzle = { id: 1 };
        jest
          .spyOn(MuzzlePersistenceService.getInstance(), "addMuzzle")
          .mockResolvedValue(mockMuzzle as Muzzle);

        jest
          .spyOn(muzzleUtils, "shouldBackfire")
          .mockImplementation(() => false);

        await muzzleService.addUserToMuzzled(
          testData.user,
          testData.requestor,
          "test"
        );
      });

      it("should return true if an id is present in the event.text ", () => {
        mockRequest.event.attachments = [];
        console.log(muzzleService.shouldBotMessageBeMuzzled(mockRequest));
        expect(muzzleService.shouldBotMessageBeMuzzled(mockRequest)).toBe(true);
      });

      it("should return true if an id is present in the event.attachments[0].text", () => {
        mockRequest.event.text = "whatever";
        mockRequest.event.attachments[0].pretext = "whatever";
        mockRequest.event.attachments[0].callback_id = "whatever";
        expect(muzzleService.shouldBotMessageBeMuzzled(mockRequest)).toBe(true);
      });

      it("should return true if an id is present in the event.attachments[0].pretext", () => {
        mockRequest.event.text = "whatever";
        mockRequest.event.attachments[0].text = "whatever";
        mockRequest.event.attachments[0].callback_id = "whatever";
        expect(muzzleService.shouldBotMessageBeMuzzled(mockRequest)).toBe(true);
      });

      it("should return the id present in the event.attachments[0].callback_id if an id is present", () => {
        mockRequest.event.text = "whatever";
        mockRequest.event.attachments[0].text = "whatever";
        mockRequest.event.attachments[0].pretext = "whatever";
        expect(muzzleService.shouldBotMessageBeMuzzled(mockRequest)).toBe(true);
      });
    });

    describe("negative path", () => {
      it("should return false if there is no id present in any fields", () => {
        mockRequest.event.text = "no id";
        mockRequest.event.callback_id = "TEST_TEST";
        mockRequest.event.attachments[0].text = "test";
        mockRequest.event.attachments[0].pretext = "test";
        mockRequest.event.attachments[0].callback_id = "TEST";
        expect(muzzleService.shouldBotMessageBeMuzzled(mockRequest)).toBe(
          false
        );
      });

      it("should return false if the message is not a bot_message", () => {
        mockRequest.event.subtype = "not_bot_message";
        expect(muzzleService.shouldBotMessageBeMuzzled(mockRequest)).toBe(
          false
        );
      });

      it("should return false if the requesting user is not muzzled", () => {
        mockRequest.event.text = "<@456>";
        mockRequest.event.attachments[0].text = "<@456>";
        mockRequest.event.attachments[0].pretext = "<@456>";
        mockRequest.event.attachments[0].callback_id = "TEST_456";
        expect(muzzleService.shouldBotMessageBeMuzzled(mockRequest)).toBe(
          false
        );
      });

      it("should return false if the bot username is muzzle", () => {
        mockRequest.event.username = "muzzle";
        expect(muzzleService.shouldBotMessageBeMuzzled(mockRequest)).toBe(
          false
        );
      });
    });
  });

  describe("addUserToMuzzled()", () => {
    describe("muzzled", () => {
      describe("positive path", () => {
        beforeEach(() => {
          const mockMuzzle = { id: 1 };
          jest
            .spyOn(MuzzlePersistenceService.getInstance(), "addMuzzle")
            .mockResolvedValue(mockMuzzle as Muzzle);

          jest
            .spyOn(muzzleUtils, "shouldBackfire")
            .mockImplementation(() => false);
        });

        it("should add a user to the muzzled map", async () => {
          await muzzleService.addUserToMuzzled(
            testData.user,
            testData.requestor,
            "test"
          );
          expect(
            MuzzlePersistenceService.getInstance().isUserMuzzled(testData.user)
          ).toBe(true);
        });

        it("should return an added user with IMuzzled attributes", async () => {
          await muzzleService.addUserToMuzzled(
            testData.user,
            testData.requestor,
            "test"
          );
          const muzzle = MuzzlePersistenceService.getInstance().getMuzzle(
            testData.user
          );
          expect(muzzle!.suppressionCount).toBe(0);
          expect(muzzle!.muzzledBy).toBe(testData.requestor);
          expect(muzzle!.id).toBe(1);
          expect(muzzle!.removalFn).toBeDefined();
        });
      });

      describe("negative path", () => {
        it("should reject if a user tries to muzzle an already muzzled user", async () => {
          const mockMuzzle = { id: 1 };
          jest
            .spyOn(MuzzlePersistenceService.getInstance(), "addMuzzle")
            .mockResolvedValue(mockMuzzle as Muzzle);
          jest
            .spyOn(muzzleUtils, "shouldBackfire")
            .mockImplementation(() => false);
          await muzzleService.addUserToMuzzled(
            testData.user,
            testData.requestor,
            "test"
          );
          expect(
            MuzzlePersistenceService.getInstance().isUserMuzzled(testData.user)
          ).toBe(true);
          await muzzleService
            .addUserToMuzzled(testData.user, testData.requestor, "test")
            .catch(e => {
              expect(e).toBe("test123 is already muzzled!");
            });
        });

        it("should reject if a user tries to muzzle a user that does not exist", async () => {
          await muzzleService
            .addUserToMuzzled("", testData.requestor, "test")
            .catch(e => {
              expect(e).toBe(
                `Invalid username passed in. You can only muzzle existing slack users`
              );
              expect(
                MuzzlePersistenceService.getInstance().isUserMuzzled("")
              ).toBe(false);
            });
        });

        it("should reject if a requestor tries to muzzle someone while the requestor is muzzled", async () => {
          await muzzleService.addUserToMuzzled(
            testData.user,
            testData.requestor,
            "test"
          );
          expect(
            MuzzlePersistenceService.getInstance().isUserMuzzled(testData.user)
          ).toBe(true);
          await muzzleService
            .addUserToMuzzled(testData.requestor, testData.user, "test")
            .catch(e => {
              expect(e).toBe(
                `You can't muzzle someone if you are already muzzled!`
              );
            });
        });
      });
    });

    describe("requestors", () => {
      describe("Max Muzzle Limit", () => {
        beforeEach(() => {
          const mockMuzzle = { id: 1 };
          jest
            .spyOn(MuzzlePersistenceService.getInstance(), "addMuzzle")
            .mockResolvedValueOnce(mockMuzzle as Muzzle);
          jest
            .spyOn(muzzleUtils, "shouldBackfire")
            .mockImplementation(() => false);
        });
        it("should prevent a requestor from muzzling on their third count", async () => {
          await muzzleService.addUserToMuzzled(
            testData.user,
            testData.requestor,
            "test"
          );
          await muzzleService.addUserToMuzzled(
            testData.user2,
            testData.requestor,
            "test"
          );
          await muzzleService
            .addUserToMuzzled(testData.user3, testData.requestor, "test")
            .catch(e =>
              expect(e).toBe(
                `You're doing that too much. Only 2 muzzles are allowed per hour.`
              )
            );
        });
      });
    });
  });

  describe("sendMuzzledMessage", () => {
    it("waste of time test suite", () => {
      expect(true).toBeTruthy();
    });
  });
});
