// ============================================================================
// AGI OS — ESLint flat config (workspace-wide)
// ----------------------------------------------------------------------------
// Philosophy:
//   * `error`  → a real bug class or a production-safety violation. CI fails.
//   * `warn`   → debt we are tracking but not blocking on. Counted in CI.
//   * No type-aware linting by default (too slow for 58 packages on every
//     commit); the `typecheck` job covers type correctness instead.
// ============================================================================

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/out/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      '**/next-env.d.ts',
      'pnpm-lock.yaml',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ---- TypeScript / JavaScript source -------------------------------------
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      // Correctness — these are real bug classes
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-throw-literal': 'error',
      'no-return-await': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-async-promise-executor': 'error',
      'require-atomic-updates': 'error',

      // Empty catch blocks silently swallow failures — the single most common
      // cause of "it said success but nothing happened" in this codebase.
      'no-empty': ['error', { allowEmptyCatch: false }],

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],

      // Allow the deliberate `catch {}` in resilience paths only when named `_`
      '@typescript-eslint/no-empty-function': 'warn',
    },
  },

  // ---- Tests: looser, they legitimately use `any` and empty fns ------------
  {
    files: ['**/tests/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // ---- Next.js dashboard: browser globals ---------------------------------
  {
    files: ['packages/dashboard/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // ---- Config / script files run in plain Node ----------------------------
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.config.{js,cjs,mjs,ts}', 'next.config.js', 'postcss.config.js', 'ecosystem.config.cjs'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { 'no-unused-vars': 'off' },
  },

  // ---- Production certification harness: stdlib-only CommonJS (tests/production) --
  // Listed last on purpose: flat config merges left-to-right, so this has to win
  // over the generic `**/*.{js,cjs,mjs}` module assumption above — the harness is
  // CommonJS run by plain `node`, with no bundler and no build step.
  {
    files: ['tests/production/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
