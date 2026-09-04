/** Runtime config. The backend (DB + API) is provided later by a predefined
 *  admin template; point NEXT_PUBLIC_API_URL at it then. */

/** Version prefix every API route lives under (backend/app.js mounts it). */
export const API_VERSION = "v1";

// Accept either name; the project standard's Vercel env uses _API_BASE_URL,
// earlier frontend code used _API_URL. Either works.
const RAW_API_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  ""
).replace(/\/$/, "");

/**
 * Base for every API call, version included — so call sites stay written as
 * `/cart` and `/orders` rather than repeating the prefix 20 times and getting
 * one of them wrong.
 *
 * The env var may or may not already carry the prefix (deployments configured
 * before versioning existed do not; CI's value does), so append it only when
 * it is absent rather than trusting either convention.
 */
export const API_URL = RAW_API_URL
  ? RAW_API_URL.endsWith(`/api/${API_VERSION}`)
    ? RAW_API_URL
    : `${RAW_API_URL}/api/${API_VERSION}`
  : "";

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/** localStorage keys for the lazy-auth session (see AuthContext). */
export const AUTH_KEYS = {
  token: "fluffy_token",
  userId: "fluffy_user_id",
  userRole: "fluffy_user_role",
  userName: "fluffy_user_name",
  userPicture: "fluffy_user_picture",
} as const;
