import { vi } from 'vitest';

globalThis.classMock = <T extends Record<PropertyKey, unknown>>(factory: () => T) =>
  vi.fn(function () {
    let instance: Record<PropertyKey, unknown> | undefined;
    const getInstance = () => {
      if (instance === undefined) {
        instance = factory();
      }
      return instance;
    };

    return new Proxy<Record<PropertyKey, unknown>>(
      {},
      {
        get(_target, prop) {
          return getInstance()[prop];
        },
        set(_target, prop, value) {
          getInstance()[prop] = value;
          return true;
        },
        has(_target, prop) {
          return prop in getInstance();
        },
      },
    );
  });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  // Restore all spies/mocks between tests.
  vi.restoreAllMocks();
});
