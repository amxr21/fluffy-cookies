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

/**
 * The dashboard branch this storefront sells from.
 *
 * Stock is held per branch in the dashboard, so every catalogue read and every
 * order must name one, and it answers 400 "Choose a store branch" without it.
 * The storefront has no branch picker, so the server decides:
 * DASHBOARD_BRANCH_ID when set, otherwise the dashboard's only selling branch.
 *
 * With several branches and no env var there is no safe guess, so this returns
 * null rather than silently selling from whichever branch happens to sort first.
 */
export async function dashboardBranchId(config: {
  origin: string;
  apiKey: string;
}): Promise<string | null> {
  const configured = process.env.DASHBOARD_BRANCH_ID?.trim();
  if (configured) return configured;

  try {
    const response = await fetch(`${config.origin}/api/v1/public/branches`, {
      headers: { "x-api-key": config.apiKey },
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: { id: string }[] };
    const branches = Array.isArray(body.data) ? body.data : [];
    if (branches.length === 1) return branches[0].id;

    console.error(
      `[storefront] ${branches.length} dashboard branches and no DASHBOARD_BRANCH_ID; the menu will be empty`
    );
    return null;
  } catch {
    return null;
  }
}
