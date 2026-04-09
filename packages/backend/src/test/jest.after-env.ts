import { vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  // Restore all spies/mocks between tests.
  vi.restoreAllMocks();
});
