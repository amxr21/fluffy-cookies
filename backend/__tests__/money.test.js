/**
 * Money helpers.
 *
 * These guard invariant 6 of the build standard: money is an integer in minor
 * units, and a float must never reach a price. The failure mode being prevented
 * is silent — a fraction of a fil lost per line only shows up later as an
 * invoice that disagrees with the sum of its own rows.
 */
const {
  assertMinor,
  toMinor,
  toMajor,
  lineTotal,
  sumMinor,
  vatPortion,
  formatMinor,
} = require("../lib/money");

describe("assertMinor", () => {
  it("accepts whole numbers, including zero", () => {
    expect(assertMinor(0)).toBe(0);
    expect(assertMinor(4800)).toBe(4800);
  });

  it("rejects a float, which is the bug it exists to catch", () => {
    expect(() => assertMinor(48.5)).toThrow(/must be an integer in minor units/);
  });

  it("rejects NaN and non-numbers rather than letting them propagate", () => {
    expect(() => assertMinor(NaN)).toThrow(TypeError);
    expect(() => assertMinor("4800")).toThrow(TypeError);
    expect(() => assertMinor(undefined)).toThrow(TypeError);
  });

  it("names the offending value in the message", () => {
    expect(() => assertMinor(1.5, "unitPrice")).toThrow(/unitPrice/);
  });
});

describe("toMinor", () => {
  it("converts major units to minor", () => {
    expect(toMinor(48)).toBe(4800);
    expect(toMinor(48.5)).toBe(4850);
    expect(toMinor(0)).toBe(0);
  });

  it("rounds rather than truncates, so no fil is silently lost", () => {
    // 48.55 * 100 is 4854.999... in binary floating point. Truncating loses a
    // fil on exactly this class of price.
    expect(toMinor(48.55)).toBe(4855);
    expect(toMinor(0.07)).toBe(7);
  });

  it("cannot rescue a value the float already lost before arriving", () => {
    // 1.005 is held as 1.00499999... so rounding gives 100, not 101. Nothing
    // here can recover the missing fraction — the damage happened at the
    // literal. This is the argument for prices never being floats in the first
    // place, and the reason this function is a boundary tool, not a habit.
    expect(toMinor(1.005)).toBe(100);
  });

  it("rejects a value that cannot be a price", () => {
    expect(() => toMinor("abc")).toThrow(TypeError);
    expect(() => toMinor(Infinity)).toThrow(TypeError);
  });
});

describe("toMajor", () => {
  it("round-trips with toMinor", () => {
    for (const price of [0, 1, 48, 48.5, 48.55, 1234.99]) {
      expect(toMajor(toMinor(price))).toBeCloseTo(price, 2);
    }
  });

  it("refuses to render a float as if it were minor units", () => {
    expect(() => toMajor(48.5)).toThrow(TypeError);
  });
});

describe("lineTotal", () => {
  it("multiplies in integers", () => {
    expect(lineTotal(4800, 3)).toBe(14400);
  });

  it("is exact where floating point would not be", () => {
    // 0.07 * 3 is 0.21000000000000002 as floats. In minor units it is 21, and
    // that difference is the entire reason for this module.
    expect(lineTotal(7, 3)).toBe(21);
  });

  it("handles a zero quantity", () => {
    expect(lineTotal(4800, 0)).toBe(0);
  });

  it("rejects a fractional or negative quantity", () => {
    expect(() => lineTotal(4800, 1.5)).toThrow(/quantity/);
    expect(() => lineTotal(4800, -1)).toThrow(/quantity/);
  });

  it("rejects a float unit price", () => {
    expect(() => lineTotal(48.5, 2)).toThrow(/unitPriceMinor/);
  });
});

describe("sumMinor", () => {
  it("sums line totals", () => {
    expect(sumMinor([4800, 4000, 5600])).toBe(14400);
  });

  it("returns 0 for an empty cart rather than NaN", () => {
    expect(sumMinor([])).toBe(0);
  });

  it("rejects a float hiding in the middle of the list", () => {
    expect(() => sumMinor([4800, 40.5, 5600])).toThrow(TypeError);
  });
});

describe("vatPortion", () => {
  // Prices are VAT-inclusive, so this extracts what is already in the gross.
  it("extracts 5% from a VAT-inclusive amount", () => {
    // 4800 gross => net 4571.43, VAT 228.57 => 229 fils rounded.
    expect(vatPortion(4800)).toBe(229);
  });

  it("never exceeds the gross it came from", () => {
    for (const gross of [1, 100, 4800, 999999]) {
      const vat = vatPortion(gross);
      expect(vat).toBeGreaterThanOrEqual(0);
      expect(vat).toBeLessThan(gross);
    }
  });

  it("returns a whole number of fils", () => {
    expect(Number.isInteger(vatPortion(4855))).toBe(true);
  });

  it("is zero for a zero amount", () => {
    expect(vatPortion(0)).toBe(0);
  });
});

describe("formatMinor", () => {
  it("renders minor units as currency", () => {
    // Intl uses a non-breaking space, so match on the parts rather than a
    // literal string that varies by ICU build.
    const out = formatMinor(4800);
    expect(out).toContain("48.00");
    expect(out).toMatch(/AED/);
  });

  it("always shows both minor digits", () => {
    expect(formatMinor(4850)).toContain("48.50");
    expect(formatMinor(4000)).toContain("40.00");
  });
});
