import { defineConfig } from 'vitest/config';

/**
 * Backend unit + integration tests.
 *
 * `node` environment: this package is a plain Express API with no DOM.
 *
 * Integration tests should import `app.js` (the app factory) and drive it with
 * supertest — no port bound, no real server. Set USE_FILE_DATA=true so they run
 * against the in-memory store and need no database, which is what makes them
 * viable in CI.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Set BEFORE any application module is imported. config/index.js reads
    // these at import time, so setting them inside a test file is too late —
    // the logger is already built and would print a full stack trace for every
    // expected 401, burying real failures in noise.
    env: {
      USE_FILE_DATA: 'true',
      LOG_CONSOLE: 'false',
      JWT_SECRET: 'test-only-secret-never-used-in-production-min-32-chars',
      GOOGLE_CLIENT_ID: 'test-only.apps.googleusercontent.com',
    },
    include: ['**/*.{test,spec}.js'],
    exclude: ['node_modules/**', 'logs/**'],
    // DB-backed tests mutate shared state. Running files in parallel against
    // one store makes cleanup order non-deterministic and failures flaky.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/**', 'logs/**', 'scripts/**', '**/*.config.js'],
      // Thresholds are 0 until a real suite exists — see the frontend config's
      // note for why a threshold above reality is worse than none.
      thresholds: { statements: 0, branches: 0, functions: 0, lines: 0 },
    },
  },
});
