import { expect } from "chai";
import * as lolex from "lolex";
import {
  addUserToMuzzled,
  containsAt,
  MAX_MUZZLES,
  muzzle,
  muzzled,
  muzzlers,
  removeMuzzle,
  removeMuzzler
} from "./muzzle-utils";

describe("muzzle-utils", () => {
  const testData = {
    user: "test-user",
    user2: "test-user2",
    user3: "test-user3",
    friendlyName: "test-muzzler",
    requestor: "test-requestor"
  };

  const clock = lolex.install();

  beforeEach(() => {
    muzzled.clear();
    muzzlers.clear();
  });

  afterEach(() => {
    clock.reset();
  });

  after(() => {
    clock.uninstall();
  });

  describe("addUserToMuzzled()", () => {
    describe("muzzled", () => {
      it("should add a user to the muzzled map", () => {
        addUserToMuzzled(
          testData.user,
          testData.friendlyName,
          testData.requestor
        );
        expect(muzzled.size).to.equal(1);
        expect(muzzled.has(testData.user)).to.equal(true);
      });

      it("should return an added user with IMuzzled attributes", () => {
        addUserToMuzzled(
          testData.user,
          testData.friendlyName,
          testData.requestor
        );
        expect(muzzled.get(testData.user)!.suppressionCount).to.equal(0);
        expect(muzzled.get(testData.user)!.muzzledBy).to.equal(
          testData.requestor
        );
      });

      it("should reject if a user tries to muzzle an already muzzled user", async () => {
        await addUserToMuzzled(
          testData.user,
          testData.friendlyName,
          testData.requestor
        );
        expect(muzzled.has(testData.user)).to.equal(true);
        await addUserToMuzzled(
          testData.user,
          testData.friendlyName,
          testData.requestor
        ).catch(e => {
          expect(e).to.equal(`${testData.friendlyName} is already muzzled!`);
        });
      });

      it("should reject if a requestor tries to muzzle someone while the requestor is muzzled", async () => {
        await addUserToMuzzled(
          testData.user,
          testData.friendlyName,
          testData.requestor
        );
        expect(muzzled.has(testData.user)).to.equal(true);
        await addUserToMuzzled(
          testData.requestor,
          testData.friendlyName,
          testData.user
        ).catch(e => {
          expect(e).to.equal(
            `You can't muzzle someone if you are already muzzled!`
          );
        });
      });
    });

    describe("muzzlers", () => {
      it("should add a user to the muzzlers map", () => {
        addUserToMuzzled(
          testData.user,
          testData.friendlyName,
          testData.requestor
        );

        expect(muzzlers.size).to.equal(1);
        expect(muzzlers.has(testData.requestor)).to.equal(true);
      });

      it("should return an added user with IMuzzler attributes", () => {
        addUserToMuzzled(
          testData.user,
          testData.friendlyName,
          testData.requestor
        );
        expect(muzzlers.get(testData.requestor)!.muzzleCount).to.equal(1);
      });

      it("should increment a requestors muzzle count on a second addUserToMuzzled() call", () => {
        addUserToMuzzled(
          testData.user,
          testData.friendlyName,
          testData.requestor
        );
        addUserToMuzzled(
          testData.user2,
          testData.friendlyName,
          testData.requestor
        );
        expect(muzzled.size).to.equal(2);
        expect(muzzlers.has(testData.requestor)).to.equal(true);
        expect(muzzlers.get(testData.requestor)!.muzzleCount).to.equal(2);
      });

      it("should prevent a requestor from muzzling on their third count", async () => {
        await addUserToMuzzled(
          testData.user,
          testData.friendlyName,
          testData.requestor
        );
        await addUserToMuzzled(
          testData.user2,
          testData.friendlyName,
          testData.requestor
        );
        await addUserToMuzzled(
          testData.user3,
          testData.friendlyName,
          testData.requestor
        ).catch(e =>
          expect(e).to.equal(
            `You're doing that too much. Only ${MAX_MUZZLES} muzzles are allowed per hour.`
          )
        );
      });
    });
  });

  describe("removeMuzzle()", () => {
    it("should remove a user from the muzzled array", () => {
      addUserToMuzzled(
        testData.user,
        testData.friendlyName,
        testData.requestor
      );
      expect(muzzled.size).to.equal(1);
      expect(muzzled.has(testData.user)).to.equal(true);
      removeMuzzle(testData.user);
      expect(muzzled.has(testData.user)).to.equal(false);
      expect(muzzled.size).to.equal(0);
    });
  });

  describe("removeMuzzler()", () => {
    it("should remove a user from the muzzler array", () => {
      addUserToMuzzled(
        testData.user,
        testData.friendlyName,
        testData.requestor
      );
      expect(muzzled.size).to.equal(1);
      expect(muzzled.has(testData.user)).to.equal(true);
      expect(muzzlers.size).to.equal(1);
      expect(muzzlers.has(testData.requestor)).to.equal(true);
      removeMuzzler(testData.requestor);
      expect(muzzlers.has(testData.requestor)).to.equal(false);
      expect(muzzlers.size).to.equal(0);
    });
  });

  describe("containsAt()", () => {
    it("should return true if a word has @ in it", () => {
      const testWord = "@channel";
      expect(containsAt(testWord)).to.equal(true);
    });

    it("should return false if a word does not include @", () => {
      const testWord = "test";
      expect(containsAt(testWord)).to.equal(false);
    });

    it("should return true if a word has <!channel> in it", () => {
      const testWord = "<!channel>";
      expect(containsAt(testWord)).to.equal(true);
    });
  });

  describe("muzzle()", () => {
    it("should always muzzle @", () => {
      const testSentence =
        "@channel @channel @channel @channel @channel @channel @channel @jrjrjr @fudka";
      expect(muzzle(testSentence)).to.equal(
        " ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm..  ..mMm.. "
      );
    });

    it("should always muzzle <!channel>", () => {
      const testSentence = "<!channel> hey guys";
      expect(muzzle(testSentence).includes("<!channel>")).to.equal(false);
    });
  });
});
