import '@testing-library/jest-dom';

// recharts' ResponsiveContainer uses ResizeObserver which jsdom doesn't implement.
// Must be a real class (not an arrow function) because recharts calls `new ResizeObserver(...)`.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
global.ResizeObserver = ResizeObserverStub;

// Node.js 25 exposes a broken global `localStorage` (methods are undefined) when
// `--localstorage-file` is not set. Override it with a functional in-memory store.
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string): string | null => store[key] ?? null,
    setItem: (key: string, value: string): void => {
      store[key] = String(value);
    },
    removeItem: (key: string): void => {
      delete store[key];
    },
    clear: (): void => {
      store = {};
    },
    get length(): number {
      return Object.keys(store).length;
    },
    key: (index: number): string | null => Object.keys(store)[index] ?? null,
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
