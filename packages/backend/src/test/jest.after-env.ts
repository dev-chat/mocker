beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  // Prevent fake timer leakage between suites.
  try {
    const timerCount = jest.getTimerCount();
    if (timerCount > 0) {
      jest.runOnlyPendingTimers();
    }
  } catch {
    // No-op when fake timers are not enabled.
  }

  jest.useRealTimers();
  jest.restoreAllMocks();
});
