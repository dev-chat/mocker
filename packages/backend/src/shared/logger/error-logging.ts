import type { Logger } from 'winston';

type LoggerLike = Pick<Logger, 'error'> | { error?: (message: string, payload?: Record<string, unknown>) => void };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export const serializeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    const details = Object.entries(error).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
      accumulator[key] = value;
      return accumulator;
    }, {});

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...details,
    };
  }

  if (isRecord(error)) {
    return { ...error };
  }

  return { value: error };
};

export const logError = (
  logger: LoggerLike,
  message: string,
  error: unknown,
  context?: Record<string, unknown>,
): void => {
  const payload: Record<string, unknown> = {
    error: serializeError(error),
  };

  if (context && Object.keys(context).length > 0) {
    payload.context = context;
  }

  if (typeof logger.error === 'function') {
    logger.error(message, payload);
  }
};
