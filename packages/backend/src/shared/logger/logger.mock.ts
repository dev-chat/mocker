import { vi } from 'vitest';
export const mockLogger: IMockLogger = {
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockImplementation(() => mockLogger),
  })),
};

interface IMockLogger {
  Logger: Mock<Record<string, () => void>>;
}
