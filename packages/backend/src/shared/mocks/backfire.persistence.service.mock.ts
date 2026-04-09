import { vi } from 'vitest';
export const MockBackFirePersistenceService = {
  addBackfire: vi.fn(),
  removeBackfire: vi.fn(),
  isBackfire: vi.fn(),
  getSuppressions: vi.fn(),
  addSuppression: vi.fn(),
  addBackfireTime: vi.fn(),
  getBackfireByUserId: vi.fn(),
  trackDeletedMessage: vi.fn(),
  incrementBackfireTime: vi.fn(),
  incrementMessageSuppressions: vi.fn(),
  incrementWordSuppressions: vi.fn(),
  incrementCharacterSuppressions: vi.fn(),
};
