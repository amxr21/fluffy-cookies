import { describe, expect, it } from "vitest";

import {
  formatMinor,
  lineTotalMinor,
  sumMinor,
  toMinor,
  vatPortionMinor,
} from "@/lib/money";

/**
 * Client-side money. Must agree with backend/lib/money.js — a total the
 * customer sees that disagrees with what the server charges is worse than
 * either being wrong on its own.
 */

describe("lineTotalMinor", () => {
  it("multiplies without floating-point drift", () => {
    // 0.07 * 3 is 0.21000000000000002 in floats; in minor units it is exact.
    expect(lineTotalMinor(7, 3)).toBe(21);
    expect(lineTotalMinor(4800, 3)).toBe(14400);
  });

  it("handles a zero quantity", () => {
    expect(lineTotalMinor(4800, 0)).toBe(0);
  });
});

describe("sumMinor", () => {
  it("sums cart lines exactly", () => {
    expect(sumMinor([4800, 4000, 5600])).toBe(14400);
  });

  it("returns 0 for an empty cart rather than NaN", () => {
    expect(sumMinor([])).toBe(0);
  });

  it("stays exact where major-unit floats would not", () => {
    // 0.1 + 0.2 !== 0.3 in floats. The same amounts in fils are exact.
    expect(sumMinor([10, 20])).toBe(30);
  });
});

describe("toMinor", () => {
  it("converts major units for static menu data", () => {
    expect(toMinor(48)).toBe(4800);
    expect(toMinor(48.5)).toBe(4850);
  });

  it("rounds rather than truncating", () => {
    expect(toMinor(48.55)).toBe(4855);
  });
});

describe("vatPortionMinor", () => {
  it("extracts the VAT already inside a VAT-inclusive amount", () => {
    expect(vatPortionMinor(4800)).toBe(229);
  });

  it("never exceeds the gross", () => {
    for (const gross of [1, 100, 4800, 999999]) {
      expect(vatPortionMinor(gross)).toBeLessThan(gross);
      expect(vatPortionMinor(gross)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("formatMinor", () => {
  it("renders minor units with both decimal places", () => {
    expect(formatMinor(4800)).toContain("48.00");
    expect(formatMinor(4850)).toContain("48.50");
  });

  it("names the currency", () => {
    expect(formatMinor(4800)).toMatch(/AED/);
  });

  it("formats zero rather than rendering an empty cart total as blank", () => {
    expect(formatMinor(0)).toContain("0.00");
  });
});
