/** Runtime config. The backend (DB + API) is provided later by a predefined
 *  admin template; point NEXT_PUBLIC_API_URL at it then. */

/** Version prefix every API route lives under (backend/app.js mounts it). */
export const API_VERSION = "v1";

/**
 * Base for every API call.
 *
 * Relative by default: next.config.ts rewrites /api/v1/* to the backend, so the
 * browser talks to this origin only. That is what lets auth cookies stay
 * SameSite=Lax — see the CSRF note in that file.
 *
 * NEXT_PUBLIC_API_URL still works as an override for a deploy that genuinely
 * needs to call the API cross-origin, but that combination also needs a CSRF
 * token layer, so it is not the default.
 */
const RAW_API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export const API_URL = RAW_API_URL
  ? RAW_API_URL.endsWith(`/api/${API_VERSION}`)
    ? RAW_API_URL
    : `${RAW_API_URL}/api/${API_VERSION}`
  : `/api/${API_VERSION}`;

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/**
 * localStorage keys for the lazy-auth session (see AuthContext).
 *
 * NOTE: `token` is gone. Auth tokens are httpOnly cookies now, unreadable by
 * script — that is the point. What remains is display data only (who is signed
 * in, for the account menu); none of it is trusted by the server, which reads
 * identity from the cookie.
 */
export const AUTH_KEYS = {
  userId: "fluffy_user_id",
  userRole: "fluffy_user_role",
  userName: "fluffy_user_name",
  userPicture: "fluffy_user_picture",
} as const;
