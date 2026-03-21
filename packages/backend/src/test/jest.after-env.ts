beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  // Safely restore mocks - Jest handles timer cleanup automatically
  jest.restoreAllMocks();
});
