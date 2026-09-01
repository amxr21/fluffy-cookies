import next from 'eslint-config-next';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * Frontend lint rules.
 *
 * `eslint-config-next` 16 exports FLAT config directly, so this imports it
 * rather than bridging through FlatCompat. The compat path is what the older
 * Next docs show, and with `next/typescript` it throws
 * "Converting circular structure to JSON" — the plugin object it produces is
 * self-referential and eslintrc tries to serialise it. Use the flat export.
 *
 * Two presets: the base rules, plus `next/typescript` for the TypeScript-aware
 * ones — the latter is what registers the @typescript-eslint plugin.
 *
 * The Next preset is the baseline because it catches the Next-specific mistakes
 * a generic React config misses: a raw <img> instead of next/image, a plain <a>
 * where <Link> belongs, a missing `key` in a list.
 */
const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'coverage/**'],
  },

  ...next,
  ...nextTypescript,

  {
    rules: {
      // `console.log` left in a component ships to the browser. `warn` and
      // `error` are legitimate — they carry real signal in production.
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // An unused variable is usually a half-finished edit. `_`-prefixed names
      // are the escape hatch for deliberately-ignored args.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  {
    // ─── react-hooks/set-state-in-effect ────────────────────────────
    // React 19 flags setState inside an effect because it usually means state
    // that should have been derived during render, and it costs a second pass.
    //
    // Downgraded to a WARNING, not disabled, because this app has a legitimate
    // instance of exactly the pattern the rule cannot distinguish: reading
    // `localStorage` to restore a session or a guest cart. That read CANNOT
    // happen during render — the server has no localStorage, so it would break
    // hydration — which leaves "effect on mount, then setState" as the only
    // correct shape.
    //
    // A warning keeps every new occurrence visible in the lint output without
    // failing CI over a pattern that is right here. If a genuine cascading-
    // render bug appears, it will already be listed.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
    },
  },

  {
    // Tests legitimately log, and fixtures use loose types.
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];

export default config;
