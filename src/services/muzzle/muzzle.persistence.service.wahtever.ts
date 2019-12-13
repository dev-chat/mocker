describe("getMuzzleId()", () => {
  it("should return the database id of the muzzledUser by id", async () => {
    const mockMuzzle = { id: 1 };
    jest
      .spyOn(MuzzlePersistenceService.getInstance(), "addMuzzleToDb")
      .mockResolvedValue(mockMuzzle as Muzzle);
    jest.spyOn(muzzleUtils, "shouldBackfire").mockImplementation(() => false);
    await muzzleInstance.addUserToMuzzled(
      testData.user,
      testData.requestor,
      "test"
    );
    expect(muzzleInstance.getMuzzleId("123")).toBe(1);
  });
});

describe("isUserMuzzled()", () => {
  beforeEach(async () => {
    const mockMuzzle = { id: 1 };
    jest
      .spyOn(MuzzlePersistenceService.getInstance(), "addMuzzleToDb")
      .mockResolvedValue(mockMuzzle as Muzzle);
    jest.spyOn(muzzleUtils, "shouldBackfire").mockImplementation(() => false);
    await muzzleInstance.addUserToMuzzled(
      testData.user,
      testData.requestor,
      "test"
    );
  });
  it("should return true when a muzzled userId is passed in", async () => {
    expect(muzzleInstance.isUserMuzzled(testData.user)).toBe(true);
  });

  it("should return false when an unmuzzled userId is passed in", async () => {
    expect(muzzleInstance.isUserMuzzled(testData.user2)).toBe(false);
  });
});
