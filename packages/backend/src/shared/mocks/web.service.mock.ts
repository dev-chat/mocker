import { vi } from 'vitest';
export const MockWebService = {
  WebService: {
    deleteMessage: vi.fn(),
    sendEphemeral: vi.fn(),
    sendMessage: vi.fn(),
    editMessage: vi.fn(),
    getAllUsers: vi.fn(),
    getAllChannels: vi.fn(),
    uploadFile: vi.fn(),
  },
};
