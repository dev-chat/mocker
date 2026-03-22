import { createLogger, format, transports } from 'winston';

const { combine, errors, timestamp, printf } = format;
const splatSymbol = Symbol.for('splat');

type LogInfo = {
  level: string;
  message: unknown;
  timestamp?: string;
  module?: string;
  context?: Record<string, unknown>;
  error?: unknown;
  stack?: string;
  name?: string;
  [key: string | symbol]: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const serializeError = (error: unknown): Record<string, unknown> => {
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

const normalizeLogInfo = format((info: LogInfo) => {
  const normalizedInfo = info;
  const splat = normalizedInfo[splatSymbol];

  if (Array.isArray(splat)) {
    for (const item of splat) {
      if (item instanceof Error) {
        normalizedInfo.error = serializeError(item);
        continue;
      }

      if (item && typeof item === 'object') {
        Object.assign(normalizedInfo, item);
      }
    }
  }

  if (normalizedInfo.error !== undefined) {
    normalizedInfo.error = serializeError(normalizedInfo.error);
  } else if (normalizedInfo.stack) {
    normalizedInfo.error = {
      name: normalizedInfo.name ?? 'Error',
      message:
        typeof normalizedInfo.message === 'string' ? normalizedInfo.message : JSON.stringify(normalizedInfo.message),
      stack: normalizedInfo.stack,
    };
  }

  return normalizedInfo;
});

const jsonLineFormat = printf((info: LogInfo) => {
  const { level, message, timestamp: loggedAt, module, context, error, stack, name, ...rest } = info;

  const meta = Object.entries(rest).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
    if (key === 'level' || key === 'message' || key === 'timestamp' || key === 'module' || key === 'context') {
      return accumulator;
    }

    accumulator[key] = value;
    return accumulator;
  }, {});

  const payload: Record<string, unknown> = {
    timestamp: loggedAt,
    level,
    module,
    message: typeof message === 'string' ? message : JSON.stringify(message),
  };

  if (context && Object.keys(context).length > 0) {
    payload.context = context;
  }

  if (error) {
    payload.error = error;
  }

  if (!error && stack) {
    payload.error = {
      name: name ?? 'Error',
      message: payload.message,
      stack,
    };
  }

  if (Object.keys(meta).length > 0) {
    payload.meta = meta;
  }

  return JSON.stringify(payload);
});

export const logger = createLogger({
  level: 'info',
  format: combine(errors({ stack: true }), timestamp(), normalizeLogInfo(), jsonLineFormat),
  defaultMeta: {},
  transports: [new transports.Console()],
});
