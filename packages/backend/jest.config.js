module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['/dist'],
  setupFiles: ['<rootDir>/src/test/jest.setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test/jest.after-env.ts'],
  moduleNameMapper: {
    '^ioredis$': '<rootDir>/src/test/mocks/ioredis.mock.ts',
    '^@slack/web-api$': '<rootDir>/src/test/mocks/slack-web-api.mock.ts',
    'logger/logger$': '<rootDir>/src/test/mocks/logger.mock.ts',
  },
};
