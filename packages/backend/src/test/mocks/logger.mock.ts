type LoggerLike = {
  child: (meta?: Record<string, unknown>) => LoggerLike;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

/**
 * Shared jest.fn() spies for all logger instances created by this mock.
 * Tests can import these directly to assert on logger calls.
 */
export const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const buildLogger = (): LoggerLike => ({
  child: (_meta?: Record<string, unknown>) => {
    void _meta;
    return buildLogger();
  },
  ...loggerMock,
});

export const logger = buildLogger();
