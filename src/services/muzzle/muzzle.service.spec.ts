import { UpdateResult } from "typeorm";
import { Muzzle } from "../../shared/db/models/Muzzle";
import { ISlackUser } from "../../shared/models/slack/slack-models";
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
      const testSentence = "<!channel> hey guys";
      expect(
        muzzleInstance.muzzle(testSentence, 1).includes("<!channel>")
      ).toBe(false);
    });
  });
});
