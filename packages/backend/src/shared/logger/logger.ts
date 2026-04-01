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

const safeStringify = (value: unknown): string => {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, nestedValue) => {
    if (typeof nestedValue === 'object' && nestedValue !== null) {
      if (seen.has(nestedValue)) {
        return '[Circular]';
      }
      seen.add(nestedValue);
    }
    return nestedValue;
  });
};

const serializeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    const serialized: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    const maybeCode = Reflect.get(error, 'code');
    if (typeof maybeCode === 'string' || typeof maybeCode === 'number') {
      serialized.code = maybeCode;
    }

    const maybeStatus = Reflect.get(error, 'status');
    if (typeof maybeStatus === 'number') {
      serialized.status = maybeStatus;
    }

    return serialized;
  }

  if (isRecord(error)) {
    return JSON.parse(safeStringify(error));
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
        typeof normalizedInfo.message === 'string' ? normalizedInfo.message : safeStringify(normalizedInfo.message),
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

    if (key === 'config' || key === 'request' || key === 'response') {
      return accumulator;
    }

    accumulator[key] = value;
    return accumulator;
  }, {});

  const payload: Record<string, unknown> = {
    timestamp: loggedAt,
    level,
    module,
    message: typeof message === 'string' ? message : safeStringify(message),
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

  return safeStringify(payload);
});

export const logger = createLogger({
  level: 'info',
  format: combine(errors({ stack: true }), timestamp(), normalizeLogInfo(), jsonLineFormat),
  defaultMeta: {},
  transports: [new transports.Console()],
});
