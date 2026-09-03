import { describe, expect, it } from "vitest";

/** Mirror of the checkout page's PHONE_RE — keep in sync. */
const PHONE_RE = /^(?:\+?971|0)(?:\s|-)?5\d(?:\s|-)?\d{3}(?:\s|-)?\d{4}$/;

describe("UAE phone validation", () => {
  it("accepts common local formats", () => {
    for (const n of [
      "0501234567",
      "050 123 4567",
      "050-123-4567",
      "971501234567",
      "+971501234567",
      "0561234567",
    ]) {
      expect(PHONE_RE.test(n), n).toBe(true);
    }
  });

  it("rejects malformed numbers", () => {
    for (const n of ["", "abc", "12345", "0401234567", "05012345"]) {
      expect(PHONE_RE.test(n), n).toBe(false);
    }
  });
});
