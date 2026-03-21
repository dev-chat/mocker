type LoggerLike = {
  child: (meta?: Record<string, unknown>) => LoggerLike;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

const buildLogger = (): LoggerLike => ({
  child: (_meta?: Record<string, unknown>) => {
    void _meta;
    return buildLogger();
  },
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
});

export const logger = buildLogger();
