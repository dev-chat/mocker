const js = require('@eslint/js');
const eslintConfigPrettier = require('eslint-config-prettier');
const globals = require('globals');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/*.d.ts', 'packages/backend/scripts/*.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        project: ['packages/backend/tsconfig.eslint.json'],
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-async-promise-executor': 'error',
      eqeqeq: ['error', 'always'],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression',
          message: 'Use narrowing, helper functions, or explicit types instead of `as` in non-spec files.',
        },
      ],
      'no-useless-escape': 'error',
      'no-extra-boolean-cast': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/unbound-method': 'warn',
    },
  },

  {
    files: ['**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  eslintConfigPrettier,
);
