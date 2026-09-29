import { describe, expect, it } from "vitest";

import { SESSION_HINT_COOKIE, hasSessionHint } from "@/lib/sessionHint";

describe("hasSessionHint", () => {
  it("finds the hint among other cookies", () => {
    expect(hasSessionHint(`theme=dark; ${SESSION_HINT_COOKIE}=1; other=x`)).toBe(true);
  });

  it("is false for a guest with no hint", () => {
    expect(hasSessionHint("theme=dark; fluffy_cart=[]")).toBe(false);
    expect(hasSessionHint("")).toBe(false);
  });

  it("does not match a cleared or different value, or a lookalike name", () => {
    expect(hasSessionHint(`${SESSION_HINT_COOKIE}=`)).toBe(false);
    expect(hasSessionHint(`${SESSION_HINT_COOKIE}=0`)).toBe(false);
    expect(hasSessionHint(`x${SESSION_HINT_COOKIE}=1`)).toBe(false);
  });
});
