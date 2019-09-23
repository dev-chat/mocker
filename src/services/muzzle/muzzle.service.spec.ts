import { UpdateResult } from "typeorm";
import { Muzzle } from "../../shared/db/models/Muzzle";
import {
  IEventRequest,
  ISlackUser
} from "../../shared/models/slack/slack-models";
import { SlackService } from "../slack/slack.service";
import { MuzzlePersistenceService } from "./muzzle.persistence.service";
import { MuzzleService } from "./muzzle.service";

describe("MuzzleService", () => {
  const testData = {
    user: "123",
    user2: "456",
    user3: "789",
    requestor: "666"
  };

  let muzzleInstance: MuzzleService;
  let slackInstance: SlackService;

  beforeEach(() => {
    muzzleInstance = MuzzleService.getInstance();
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
      expect(muzzleInstance.muzzle(testSentence, 1)).toBe(
        " ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm.. "
      );
    });

    it("should always muzzle <!channel>", () => {
      const testSentence = "<!channel>";
      expect(muzzleInstance.muzzle(testSentence, 1)).toBe(" ..mMm.. ");
    });

    it("should always muzzle <!here>", () => {
      const testSentence = "<!here>";
      expect(muzzleInstance.muzzle(testSentence, 1)).toBe(" ..mMm.. ");
    });

    it("should always muzzle a word with length > 10", () => {
      const testSentence = "this.is.a.way.to.game.the.system";
      expect(muzzleInstance.muzzle(testSentence, 1)).toBe(" ..mMm.. ");
    });
  });

  describe("getMuzzleId()", () => {
    it("should return the database id of the muzzledUser by id", async () => {
      const mockMuzzle = { id: 1 };
      jest
        .spyOn(MuzzlePersistenceService.getInstance(), "addMuzzleToDb")
        .mockResolvedValue(mockMuzzle as Muzzle);
      await muzzleInstance.addUserToMuzzled(testData.user, testData.requestor);
      expect(muzzleInstance.getMuzzleId("123")).toBe(1);
    });
  });

  describe("getMuzzledUserById()", () => {
    beforeEach(async () => {
      const mockMuzzle = { id: 1 };
      jest
        .spyOn(MuzzlePersistenceService.getInstance(), "addMuzzleToDb")
        .mockResolvedValue(mockMuzzle as Muzzle);
      await muzzleInstance.addUserToMuzzled(testData.user, testData.requestor);
    });

    it("should return the muzzled user when a valid id is passed in", async () => {
      const muzzledUser = muzzleInstance.getMuzzledUserById("123");
      expect(muzzledUser!.id).toBe(1);
      expect(muzzledUser!.muzzledBy).toBe("666");
      expect(muzzledUser!.removalFn).toBeDefined();
      expect(muzzledUser!.suppressionCount).toBe(0);
    });
  });

  describe("getRequestorById()", () => {
    beforeEach(async () => {
      const mockMuzzle = { id: 1 };
      jest
        .spyOn(MuzzlePersistenceService.getInstance(), "addMuzzleToDb")
        .mockResolvedValue(mockMuzzle as Muzzle);
      await muzzleInstance.addUserToMuzzled(testData.user, testData.requestor);
    });
    it("should return the requestor when a valid id is passed in", async () => {
      const requestor = muzzleInstance.getRequestorById("666");
      expect(requestor!.muzzleCount).toBe(1);
      expect(requestor!.muzzleCountRemover).toBeDefined();
    });
  });

  describe("isUserMuzzled()", () => {
    beforeEach(async () => {
      const mockMuzzle = { id: 1 };
      jest
        .spyOn(MuzzlePersistenceService.getInstance(), "addMuzzleToDb")
        .mockResolvedValue(mockMuzzle as Muzzle);
      await muzzleInstance.addUserToMuzzled(testData.user, testData.requestor);
    });
    it("should return true when a muzzled userId is passed in", async () => {
      expect(muzzleInstance.isUserMuzzled(testData.user)).toBe(true);
    });

    it("should return false when an unmuzzled userId is passed in", async () => {
      expect(muzzleInstance.isUserMuzzled(testData.user2)).toBe(false);
    });
  });

  describe("isUserRequestor()", () => {
    beforeEach(async () => {
      const mockMuzzle = { id: 1 };
      jest
        .spyOn(MuzzlePersistenceService.getInstance(), "addMuzzleToDb")
        .mockResolvedValue(mockMuzzle as Muzzle);
      await muzzleInstance.addUserToMuzzled(testData.user, testData.requestor);
    });

    it("should return true when a requestor userId is passed in", () => {
      expect(muzzleInstance.isUserRequestor(testData.requestor)).toBe(true);
    });

    it("should return false when a non-requestor userId is passed in", () => {
      expect(muzzleInstance.isUserRequestor(testData.user)).toBe(false);
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
    describe("positive path", () => {
      beforeEach(async () => {
        await muzzleInstance.addUserToMuzzled(
          testData.user,
          testData.requestor
        );
      });
      it("should return true if an id is present in the event.text ", () => {
        mockRequest.event.attachments = [];
        expect(muzzleInstance.shouldBotMessageBeMuzzled(mockRequest)).toBe(
          true
        );
      });

      it("should return true if an id is present in the event.attachments[0].text", () => {
        mockRequest.event.text = "whatever";
        mockRequest.event.attachments[0].pretext = "whatever";
        mockRequest.event.attachments[0].callback_id = "whatever";
        expect(muzzleInstance.shouldBotMessageBeMuzzled(mockRequest)).toBe(
          true
        );
      });

      it("should return true if an id is present in the event.attachments[0].pretext", () => {
        mockRequest.event.text = "whatever";
        mockRequest.event.attachments[0].text = "whatever";
        mockRequest.event.attachments[0].callback_id = "whatever";
        expect(muzzleInstance.shouldBotMessageBeMuzzled(mockRequest)).toBe(
          true
        );
      });

      it("should return the id present in the event.attachments[0].callback_id if an id is present", () => {
        mockRequest.event.text = "whatever";
        mockRequest.event.attachments[0].text = "whatever";
        mockRequest.event.attachments[0].pretext = "whatever";
        expect(muzzleInstance.shouldBotMessageBeMuzzled(mockRequest)).toBe(
          true
        );
      });
    });

    describe("negative path", () => {
      it("should return false if there is no id present in any fields", () => {
        mockRequest.event.text = "no id";
        mockRequest.event.callback_id = "TEST_TEST";
        mockRequest.event.attachments[0].text = "test";
        mockRequest.event.attachments[0].pretext = "test";
        mockRequest.event.attachments[0].callback_id = "TEST";
        expect(muzzleInstance.shouldBotMessageBeMuzzled(mockRequest)).toBe(
          false
        );
      });

      it("should return false if the message is not a bot_message", () => {
        mockRequest.event.subtype = "not_bot_message";
        expect(muzzleInstance.shouldBotMessageBeMuzzled(mockRequest)).toBe(
          false
        );
      });

      it("should return false if the requesting user is not muzzled", () => {
        mockRequest.event.text = "<@456>";
        mockRequest.event.attachments[0].text = "<@456>";
        mockRequest.event.attachments[0].pretext = "<@456>";
        mockRequest.event.attachments[0].callback_id = "TEST_456";
        expect(muzzleInstance.shouldBotMessageBeMuzzled(mockRequest)).toBe(
          false
        );
      });

      it("should return false if the bot username is muzzle", () => {
        mockRequest.event.username = "muzzle";
        expect(muzzleInstance.shouldBotMessageBeMuzzled(mockRequest)).toBe(
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
            .spyOn(MuzzlePersistenceService.getInstance(), "addMuzzleToDb")
            .mockResolvedValue(mockMuzzle as Muzzle);
        });

        it("should add a user to the muzzled map", async () => {
          await muzzleInstance.addUserToMuzzled(
            testData.user,
            testData.requestor
          );
          expect(muzzleInstance.isUserMuzzled(testData.user)).toBe(true);
        });

        it("should return an added user with IMuzzled attributes", async () => {
          await muzzleInstance.addUserToMuzzled(
            testData.user,
            testData.requestor
          );
          expect(
            muzzleInstance.getMuzzledUserById(testData.user)!.suppressionCount
          ).toBe(0);
          expect(
            muzzleInstance.getMuzzledUserById(testData.user)!.muzzledBy
          ).toBe(testData.requestor);
          expect(muzzleInstance.getMuzzledUserById(testData.user)!.id).toBe(1);
          expect(
            muzzleInstance.getMuzzledUserById(testData.user)!.removalFn
          ).toBeDefined();
        });
      });

      describe("negative path", () => {
        it("should reject if a user tries to muzzle an already muzzled user", async () => {
          const mockMuzzle = { id: 1 };
          jest
            .spyOn(MuzzlePersistenceService.getInstance(), "addMuzzleToDb")
            .mockResolvedValue(mockMuzzle as Muzzle);
          await muzzleInstance.addUserToMuzzled(
            testData.user,
            testData.requestor
          );
          expect(muzzleInstance.isUserMuzzled(testData.user)).toBe(true);
          await muzzleInstance
            .addUserToMuzzled(testData.user, testData.requestor)
            .catch(e => {
              expect(e).toBe("test123 is already muzzled!");
            });
        });

        it("should reject if a user tries to muzzle a user that does not exist", async () => {
          await muzzleInstance
            .addUserToMuzzled("", testData.requestor)
            .catch(e => {
              expect(e).toBe(
                `Invalid username passed in. You can only muzzle existing slack users`
              );
              expect(muzzleInstance.isUserMuzzled("")).toBe(false);
            });
        });

        it("should reject if a requestor tries to muzzle someone while the requestor is muzzled", async () => {
          await muzzleInstance.addUserToMuzzled(
            testData.user,
            testData.requestor
          );
          expect(muzzleInstance.isUserMuzzled(testData.user)).toBe(true);
          await muzzleInstance
            .addUserToMuzzled(testData.requestor, testData.user)
            .catch(e => {
              expect(e).toBe(
                `You can't muzzle someone if you are already muzzled!`
              );
            });
        });
      });
    });

    describe("requestors", () => {
      describe("positive path", () => {
        beforeEach(() => {
          const mockMuzzle = { id: 1 };
          jest
            .spyOn(MuzzlePersistenceService.getInstance(), "addMuzzleToDb")
            .mockResolvedValue(mockMuzzle as Muzzle);
        });
        it("should add a user to the requestors map", async () => {
          await muzzleInstance.addUserToMuzzled(
            testData.user,
            testData.requestor
          );
          expect(muzzleInstance.isUserRequestor(testData.requestor)).toBe(true);
        });

        it("should return an added user with IMuzzler attributes", async () => {
          await muzzleInstance.addUserToMuzzled(
            testData.user,
            testData.requestor
          );
          expect(
            muzzleInstance.getRequestorById(testData.requestor)!.muzzleCount
          ).toBe(1);
        });

        it("should increment a requestors muzzle count on a second muzzleInstance.addUserToMuzzled() call", async () => {
          await muzzleInstance.addUserToMuzzled(
            testData.user,
            testData.requestor
          );
          await muzzleInstance.addUserToMuzzled(
            testData.user2,
            testData.requestor
          );
          expect(muzzleInstance.isUserRequestor(testData.requestor)).toBe(true);
          expect(
            muzzleInstance.getRequestorById(testData.requestor)!.muzzleCount
          ).toBe(2);
        });
      });

      describe("negative path", () => {
        beforeEach(() => {
          const mockMuzzle = { id: 1 };
          jest
            .spyOn(MuzzlePersistenceService.getInstance(), "addMuzzleToDb")
            .mockResolvedValueOnce(mockMuzzle as Muzzle);
          jest
            .spyOn(MuzzlePersistenceService.getInstance(), "addMuzzleToDb")
            .mockResolvedValueOnce(mockMuzzle as Muzzle);
        });
        it("should prevent a requestor from muzzling on their third count", async () => {
          await muzzleInstance.addUserToMuzzled(
            testData.user,
            testData.requestor
          );
          await muzzleInstance.addUserToMuzzled(
            testData.user2,
            testData.requestor
          );
          await muzzleInstance
            .addUserToMuzzled(testData.user3, testData.requestor)
            .catch(e =>
              expect(e).toBe(
                `You're doing that too much. Only 2 muzzles are allowed per hour.`
              )
            );
        });
      });
    });
  });
});
