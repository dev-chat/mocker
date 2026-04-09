import { vi } from 'vitest';
export const MockTranslationService = {
  translate: vi.fn(),
  getRandomLanguage: vi.fn(),
};
