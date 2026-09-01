import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Frontend unit + component tests.
 *
 * jsdom rather than node: these render React components, which need a DOM.
 * Anything that talks to the real API belongs in an E2E suite instead — a unit
 * test that needs a running server is not a unit test.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirrors the `@/*` path alias in tsconfig.json. Without this, every test
    // importing `@/lib/...` fails to resolve and the failure looks like a
    // missing file rather than a config gap.
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        '.next/**',
        '**/*.config.{ts,mjs,js}',
        '**/*.d.ts',
        'vitest.setup.ts',
      ],
      // ─────────────────────────────────────────────────────────────
      // THRESHOLDS ARE 0 ON PURPOSE — there is no test suite yet.
      //
      // A threshold above the current reality fails CI on every commit and
      // gets disabled within a day, which is worse than not having one. Raise
      // these deliberately as real tests land (project-test-gen writes them),
      // so the number always reflects a bar the code actually clears.
      // ─────────────────────────────────────────────────────────────
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
});
