import { vi } from 'vitest';
export const OpenAIMock = {
  OpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
    images: {
      generate: vi.fn(),
    },
  })),
};
