/**
 * Avatar host allowlist.
 *
 * next/image refuses any remote host missing from `remotePatterns` in
 * next.config.ts — and the refusal is a thrown error that unmounts the whole
 * page, not a broken image. Checking the host first turns a crash into a
 * fallback initial.
 *
 * Keep this list in step with next.config.ts: a host here but not there still
 * crashes, and a host there but not here just renders the initial needlessly.
 */
export const ALLOWED_AVATAR_HOSTS = ["lh3.googleusercontent.com"];

export function isAllowedAvatarHost(src: string): boolean {
  try {
    return ALLOWED_AVATAR_HOSTS.includes(new URL(src).hostname);
  } catch {
    // Not a parseable absolute URL. A relative path is served by this origin
    // and needs no allowlisting; anything else (data:, garbage) is refused.
    return src.startsWith("/");
  }
}
