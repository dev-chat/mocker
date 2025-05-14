export const MockBackFirePersistenceService = {
  addBackfire: jest.fn(),
  removeBackfire: jest.fn(),
  isBackfire: jest.fn(),
  getSuppressions: jest.fn(),
  addSuppression: jest.fn(),
  addBackfireTime: jest.fn(),
  getBackfireByUserId: jest.fn(),
  trackDeletedMessage: jest.fn(),
  incrementBackfireTime: jest.fn(),
  incrementMessageSuppressions: jest.fn(),
  incrementWordSuppressions: jest.fn(),
  incrementCharacterSuppressions: jest.fn(),
};
