import { expect } from "chai";
import * as lolex from "lolex";
import { ISlackUser } from "../../shared/models/slack/slack-models";
import { setUserList } from "../slack/slack-utils";
import {
  addUserToMuzzled,
  containsTag,
  muzzle,
  muzzled,
  removeMuzzle,
  removeMuzzler,
  requestors
} from "./muzzle-utils";

describe("muzzle-utils", () => {
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

  after(() => {
    clock.uninstall();
  });

  describe("addUserToMuzzled()", () => {
    describe("muzzled", () => {
      it("should add a user to the muzzled map", () => {
        addUserToMuzzled(testData.user, testData.requestor);
        expect(muzzled.size).to.equal(1);
        expect(muzzled.has(testData.user)).to.equal(true);
      });

      it("should return an added user with IMuzzled attributes", () => {
        addUserToMuzzled(testData.user, testData.requestor);
        expect(muzzled.get(testData.user)!.suppressionCount).to.equal(0);
        expect(muzzled.get(testData.user)!.muzzledBy).to.equal(
          testData.requestor
        );
      });

      it("should reject if a user tries to muzzle an already muzzled user", async () => {
        await addUserToMuzzled(testData.user, testData.requestor);
        expect(muzzled.has(testData.user)).to.equal(true);
        await addUserToMuzzled(testData.user, testData.requestor).catch(e => {
          expect(e).to.equal("test123 is already muzzled!");
        });
      });

      it("should reject if a requestor tries to muzzle someone while the requestor is muzzled", async () => {
        await addUserToMuzzled(testData.user, testData.requestor);
        expect(muzzled.has(testData.user)).to.equal(true);
        await addUserToMuzzled(testData.requestor, testData.user).catch(e => {
          expect(e).to.equal(
            `You can't muzzle someone if you are already muzzled!`
          );
        });
      });
    });

    describe("requestors", () => {
      it("should add a user to the requestors map", () => {
        addUserToMuzzled(testData.user, testData.requestor);

        expect(requestors.size).to.equal(1);
        expect(requestors.has(testData.requestor)).to.equal(true);
      });

      it("should return an added user with IMuzzler attributes", () => {
        addUserToMuzzled(testData.user, testData.requestor);
        expect(requestors.get(testData.requestor)!.muzzleCount).to.equal(1);
      });

      it("should increment a requestors muzzle count on a second addUserToMuzzled() call", () => {
        addUserToMuzzled(testData.user, testData.requestor);
        addUserToMuzzled(testData.user2, testData.requestor);
        expect(muzzled.size).to.equal(2);
        expect(requestors.has(testData.requestor)).to.equal(true);
        expect(requestors.get(testData.requestor)!.muzzleCount).to.equal(2);
      });

      it("should prevent a requestor from muzzling on their third count", async () => {
        await addUserToMuzzled(testData.user, testData.requestor);
        await addUserToMuzzled(testData.user2, testData.requestor);
        await addUserToMuzzled(testData.user3, testData.requestor).catch(e =>
          expect(e).to.equal(
            `You're doing that too much. Only 2 muzzles are allowed per hour.`
          )
        );
      });
    });
  });

  describe("removeMuzzle()", () => {
    it("should remove a user from the muzzled array", () => {
      addUserToMuzzled(testData.user, testData.requestor);
      expect(muzzled.size).to.equal(1);
      expect(muzzled.has(testData.user)).to.equal(true);
      removeMuzzle(testData.user);
      expect(muzzled.has(testData.user)).to.equal(false);
      expect(muzzled.size).to.equal(0);
    });
  });

  describe("removeMuzzler()", () => {
    it("should remove a user from the muzzler array", () => {
      addUserToMuzzled(testData.user, testData.requestor);
      expect(muzzled.size).to.equal(1);
      expect(muzzled.has(testData.user)).to.equal(true);
      expect(requestors.size).to.equal(1);
      expect(requestors.has(testData.requestor)).to.equal(true);
      removeMuzzler(testData.requestor);
      expect(requestors.has(testData.requestor)).to.equal(false);
      expect(requestors.size).to.equal(0);
    });
  });

  describe("containsTag()", () => {
    it("should return false if a word has @ in it and is not a tag", () => {
      const testWord = ".@channel";
      expect(containsTag(testWord)).to.equal(false);
    });

    it("should return false if a word does not include @", () => {
      const testWord = "test";
      expect(containsTag(testWord)).to.equal(false);
    });

    it("should return true if a word has <!channel> in it", () => {
      const testWord = "<!channel>";
      expect(containsTag(testWord)).to.equal(true);
    });

    it("should return true if a word has <!here> in it", () => {
      const testWord = "<!here>";
      expect(containsTag(testWord)).to.equal(true);
    });

    it("should return true if a word has a tagged user", () => {
      const testUser = "<@UTJFJKL>";
      expect(containsTag(testUser)).to.equal(true);
    });
  });

  describe("muzzle()", () => {
    it("should always muzzle a tagged user", () => {
      const testSentence =
        "<@U2TKJ> <@JKDSF> <@SDGJSK> <@LSKJDSG> <@lkjdsa> <@LKSJDF> <@SDLJG> <@jrjrjr> <@fudka>";
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
