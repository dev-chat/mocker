import * as lolex from "lolex";
import { ISlackUser } from "../../shared/models/slack/slack-models";
import { setUserList } from "../slack/slack-utils";
import {
  addUserToMuzzled,
  muzzle,
  muzzled,
  removeMuzzle,
  removeRequestor,
  requestors
} from "./muzzle";

describe("muzzle", () => {
  const testData = {
    user: "123",
    user2: "456",
    user3: "789",
    requestor: "666"
  };

  const clock = lolex.install();

  beforeEach(() => {
    muzzled.clear();
    requestors.clear();
    setUserList([
      { id: "123", name: "test123" },
      { id: "456", name: "test456" },
      { id: "789", name: "test789" },
      { id: "666", name: "requestor" }
    ] as ISlackUser[]);
  });

  afterEach(() => {
    clock.reset();
  });

  afterAll(() => {
    clock.uninstall();
  });

  describe("addUserToMuzzled()", () => {
    describe("muzzled", () => {
      it("should add a user to the muzzled map", async () => {
        await addUserToMuzzled(testData.user, testData.requestor);
        expect(muzzled.size).toBe(1);
        expect(muzzled.has(testData.user)).toBe(true);
      });

      it("should return an added user with IMuzzled attributes", async () => {
        await addUserToMuzzled(testData.user, testData.requestor);
        expect(muzzled.get(testData.user)!.suppressionCount).toBe(0);
        expect(muzzled.get(testData.user)!.muzzledBy).toBe(testData.requestor);
        expect(muzzled.get(testData.user)!.id).toBe(1);
        expect(muzzled.get(testData.user)!.removalFn).toBeDefined();
      });

      it("should reject if a user tries to muzzle an already muzzled user", async () => {
        await addUserToMuzzled(testData.user, testData.requestor);
        expect(muzzled.has(testData.user)).toBe(true);
        await addUserToMuzzled(testData.user, testData.requestor).catch(e => {
          expect(e).toBe("test123 is already muzzled!");
        });
      });

      it("should reject if a user tries to muzzle a user that does not exist", async () => {
        await addUserToMuzzled("", testData.requestor);
        expect(muzzled.has("")).toBe(false);
        await addUserToMuzzled("", testData.requestor).catch(e => {
          expect(e).toBe(
            `Invalid username passed in. You can only muzzle existing slack users`
          );
        });
      });

      it("should reject if a requestor tries to muzzle someone while the requestor is muzzled", async () => {
        await addUserToMuzzled(testData.user, testData.requestor);
        expect(muzzled.has(testData.user)).toBe(true);
        await addUserToMuzzled(testData.requestor, testData.user).catch(e => {
          expect(e).toBe(
            `You can't muzzle someone if you are already muzzled!`
          );
        });
      });
    });

    describe("requestors", () => {
      it("should add a user to the requestors map", () => {
        addUserToMuzzled(testData.user, testData.requestor);

        expect(requestors.size).toBe(1);
        expect(requestors.has(testData.requestor)).toBe(true);
      });

      it("should return an added user with IMuzzler attributes", () => {
        addUserToMuzzled(testData.user, testData.requestor);
        expect(requestors.get(testData.requestor)!.muzzleCount).toBe(1);
      });

      it("should increment a requestors muzzle count on a second addUserToMuzzled() call", () => {
        addUserToMuzzled(testData.user, testData.requestor);
        addUserToMuzzled(testData.user2, testData.requestor);
        expect(muzzled.size).toBe(2);
        expect(requestors.has(testData.requestor)).toBe(true);
        expect(requestors.get(testData.requestor)!.muzzleCount).toBe(2);
      });

      it("should prevent a requestor from muzzling on their third count", async () => {
        await addUserToMuzzled(testData.user, testData.requestor);
        await addUserToMuzzled(testData.user2, testData.requestor);
        await addUserToMuzzled(testData.user3, testData.requestor).catch(e =>
          expect(e).toBe(
            `You're doing that too much. Only 2 muzzles are allowed per hour.`
          )
        );
      });
    });
  });

  describe("removeMuzzle()", () => {
    it("should remove a user from the muzzled array", () => {
      addUserToMuzzled(testData.user, testData.requestor);
      expect(muzzled.size).toBe(1);
      expect(muzzled.has(testData.user)).toBe(true);
      removeMuzzle(testData.user);
      expect(muzzled.has(testData.user)).toBe(false);
      expect(muzzled.size).toBe(0);
    });
  });

  describe("removeRequestor()", () => {
    it("should remove a user from the muzzler array", () => {
      addUserToMuzzled(testData.user, testData.requestor);
      expect(muzzled.size).toBe(1);
      expect(muzzled.has(testData.user)).toBe(true);
      expect(requestors.size).toBe(1);
      expect(requestors.has(testData.requestor)).toBe(true);
      removeRequestor(testData.requestor);
      expect(requestors.has(testData.requestor)).toBe(false);
      expect(requestors.size).toBe(0);
    });
  });

  describe("muzzle()", () => {
    it("should always muzzle a tagged user", () => {
      const testSentence =
        "<@U2TKJ> <@JKDSF> <@SDGJSK> <@LSKJDSG> <@lkjdsa> <@LKSJDF> <@SDLJG> <@jrjrjr> <@fudka>";
      expect(muzzle(testSentence, 1)).toBe(
        " ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm.. "
      );
    });

    it("should always muzzle <!channel>", () => {
      const testSentence = "<!channel> hey guys";
      expect(muzzle(testSentence, 1).includes("<!channel>")).toBe(false);
    });
  });
});
