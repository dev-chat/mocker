import '@testing-library/jest-dom';

// recharts' ResponsiveContainer uses ResizeObserver which jsdom doesn't implement.
// Must be a real class (not an arrow function) because recharts calls `new ResizeObserver(...)`.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
global.ResizeObserver = ResizeObserverStub;
