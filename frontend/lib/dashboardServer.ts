/**
 * Server-side access to the admin dashboard's public API.
 *
 * The dashboard requires an integration key (`X-API-Key`) on every
 * `/api/v1/public/*` request, on top of the shopper's own Bearer token. The key
 * is a secret, so it lives in a server-only env var (no NEXT_PUBLIC_ prefix)
 * and is only ever attached here, on the storefront server — never in the
 * browser.
 */

/** Dashboard origin and integration key, or null when either is unset. */
export function dashboardServerConfig(): { origin: string; apiKey: string } | null {
  const origin = process.env.API_ORIGIN?.replace(/\/$/, "");
  const apiKey = process.env.DASHBOARD_API_KEY?.trim();
  if (!origin || !apiKey) return null;
  return { origin, apiKey };
}
