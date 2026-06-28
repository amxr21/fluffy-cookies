/** Runtime config. The backend (DB + API) is provided later by a predefined
 *  admin template; point NEXT_PUBLIC_API_URL at it then. */

// Accept either name; the project standard's Vercel env uses _API_BASE_URL,
// earlier frontend code used _API_URL. Either works.
export const API_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  ""
).replace(/\/$/, "");

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
