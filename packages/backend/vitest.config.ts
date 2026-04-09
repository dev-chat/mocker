import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['src/test/vitest.setup.ts', 'src/test/vitest.after-env.ts'],
    include: ['src/**/*.spec.ts'],
    exclude: ['dist/**'],
    coverage: {
      provider: 'v8',
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: [
      {
        find: /^typeorm$/,
        replacement: './src/test/mocks/typeorm.mock.ts',
      },
      {
        find: 'typeorm/decorator/relations/JoinColumn',
        replacement: './src/test/mocks/typeorm-join-column.mock.ts',
      },
      {
        find: 'typeorm/driver/mongodb/bson.typings',
        replacement: './src/test/mocks/typeorm-bson-typings.mock.ts',
      },
      {
        find: 'ioredis',
        replacement: './src/test/mocks/ioredis.mock.ts',
      },
      {
        find: '@slack/web-api',
        replacement: './src/test/mocks/slack-web-api.mock.ts',
      },
      {
        find: /^(.*\/)?logger\/logger$/,
        replacement: './src/test/mocks/logger.mock.ts',
      },
    ],
  },
});
