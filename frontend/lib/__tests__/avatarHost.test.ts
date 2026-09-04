import { describe, expect, it } from "vitest";

import { isAllowedAvatarHost } from "@/lib/avatarHost";

/**
 * next/image throws on a host missing from next.config's `remotePatterns`, and
 * that error unmounts the whole page rather than just dropping the image. These
 * cover the guard that keeps a stray avatar URL from taking the app down.
 */

describe("isAllowedAvatarHost", () => {
  it("allows the Google avatar host", () => {
    expect(
      isAllowedAvatarHost("https://lh3.googleusercontent.com/a/ACg8ocK=s96-c")
    ).toBe(true);
  });

  it("rejects a host that next/image is not configured for", () => {
    // Would otherwise crash the page on render.
    expect(isAllowedAvatarHost("https://avatars.githubusercontent.com/u/1")).toBe(
      false
    );
    expect(isAllowedAvatarHost("https://example.com/me.png")).toBe(false);
  });

  it("rejects a lookalike host rather than matching on a substring", () => {
    // `endsWith`/`includes` checks pass this; hostname equality does not.
    expect(
      isAllowedAvatarHost("https://lh3.googleusercontent.com.evil.test/a/x")
    ).toBe(false);
  });

  it("allows a relative path, which this origin serves itself", () => {
    expect(isAllowedAvatarHost("/images/default-avatar.png")).toBe(true);
  });

  it("rejects unparseable or empty input instead of throwing", () => {
    expect(isAllowedAvatarHost("")).toBe(false);
    expect(isAllowedAvatarHost("not a url")).toBe(false);
  });

  it("rejects a data URI, which the allowlist does not cover", () => {
    expect(isAllowedAvatarHost("data:image/png;base64,iVBORw0KGgo=")).toBe(false);
  });
});
