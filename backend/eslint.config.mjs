import js from '@eslint/js';
import globals from 'globals';

/**
 * Backend lint rules.
 *
 * Plain CommonJS Node — no TypeScript in this package, so the type-aware rules
 * the frontend gets do not apply here. What is left still matters: an unused
 * variable, an unhandled promise, or a stray `console.log` are all real bugs in
 * a long-running server.
 */
export default [
  {
    ignores: ['node_modules/**', 'logs/**', 'coverage/**'],
  },

  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // The server has a structured logger (logger/index.js). A bare console
      // call bypasses log levels, rotation and the request id, so it is a real
      // problem rather than a style preference.
      //
      // Scripts are exempt below — they are operator-facing CLIs whose whole
      // output IS the console.
      'no-console': 'error',

      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // A rejected promise nobody awaits takes down the process. This is the
      // single most valuable rule in a Node service.
      'no-floating-decimal': 'error',

      // `require-atomic-updates` is deliberately OFF for this package. It flags
      // `req.user.role = ...` after an await in middleware, reading that as a
      // race. It is not one: Express gives every request its own `req` object,
      // so two requests never interleave on the same one. Left on, the rule
      // reports a false positive on correct auth code, and the only ways to
      // silence it are a per-line disable or restructuring working middleware
      // to satisfy a checker rather than a requirement.
    },
  },

  {
    // Operator-facing CLIs: migrate, seed, preflight checks. Printing to the
    // console is their entire purpose.
    files: ['scripts/**/*.js'],
    rules: {
      'no-console': 'off',
    },
  },

  {
    files: ['**/*.test.js', '**/__tests__/**'],
    languageOptions: {
      globals: {
        ...globals.node,
        // vitest.config.mjs sets `globals: true`, so describe/it/expect exist
        // without an import. ESLint cannot infer that from the config, so they
        // are declared here — otherwise every assertion is a `no-undef` error.
        ...globals.vitest,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
];
