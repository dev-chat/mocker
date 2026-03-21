module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['/dist'],
  setupFiles: ['<rootDir>/src/test/jest.setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test/jest.after-env.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^ioredis$': '<rootDir>/src/test/mocks/ioredis.mock.ts',
    '^@slack/web-api$': '<rootDir>/src/test/mocks/slack-web-api.mock.ts',
    '^(.*/)?logger/logger$': '<rootDir>/src/test/mocks/logger.mock.ts',
  },
};
