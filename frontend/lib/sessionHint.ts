/**
 * "Probably signed in" — a readable hint cookie beside the real session.
 *
 * The session itself is an httpOnly cookie scoped to /api/storefront, so page
 * script cannot see it, and the only way to learn whether a visitor is signed
 * in was to ask the dashboard (`/me`) on every page view. Every one of those
 * calls spends the dashboard's per-shopper rate budget, and for a guest it is
 * a guaranteed 401.
 *
 * The bridge sets this hint on sign-in and clears it on sign-out or when the
 * dashboard rejects the session. It grants nothing: the server never reads it,
 * and a forged hint only earns a visitor the same 401 they would have got
 * anyway.
 */
export const SESSION_HINT_COOKIE = "fluffy_signed_in";

/** Whether a `document.cookie` string carries the hint. */
export function hasSessionHint(cookieHeader: string): boolean {
  return cookieHeader
    .split(";")
    .some((part) => part.trim() === `${SESSION_HINT_COOKIE}=1`);
}
