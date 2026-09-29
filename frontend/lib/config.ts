/** Runtime config. Everything commercial — menu, cart, favourites, orders,
 *  customers — lives in the admin dashboard; the storefront reaches it only
 *  through its own same-origin bridge. */

/**
 * Base for every client-side API call: the bridge at app/api/storefront.
 *
 * Same-origin on purpose. The browser never learns the dashboard's address or
 * its integration key, and the session cookie stays SameSite=Lax because it is
 * never sent cross-site.
 */
export const DASHBOARD_API_URL = "/api/storefront";

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
