export const mockLogger: IMockLogger = {
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockImplementation(() => mockLogger),
  })),
};

interface IMockLogger {
  Logger: jest.Mock<Record<string, () => void>>;
}
