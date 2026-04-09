import { vi } from 'vitest';
export const MockSlackService = {
  sendResponse: vi.fn(),
  getUserId: vi.fn(),
  getUserIdByName: vi.fn(),
  getUserNameById: vi.fn(),
  getUserIdByCallbackId: vi.fn(),
  getBotId: vi.fn(),
  containsTag: vi.fn(),
  getAndSaveAllChannels: vi.fn(),
  getChannelName: vi.fn(),
  getImpersonatedUser: vi.fn(),
  getAllUsers: vi.fn(),
  getBotByBotId: vi.fn(),
  getUserById: vi.fn(),
  handle: vi.fn(),
};
