/**
 * Money handling. Every amount in this system is an integer in minor units
 * (fils) with an explicit currency — floats never touch a price.
 *
 * Prices are VAT-inclusive: a stored amount is the gross the customer pays.
 * `vatPortion` exists for display and invoicing, and does not change what is
 * charged.
 */

/** AED, and every currency this app handles, has 2 minor units. */
const MINOR_UNITS = 2;
const FACTOR = 10 ** MINOR_UNITS;

const DEFAULT_CURRENCY = "AED";

/** UAE VAT rate, as a fraction of the net amount. */
const VAT_RATE = 0.05;

/**
 * Guard an amount that must be a whole number of minor units.
 *
 * Called at every boundary where money enters a calculation, because the whole
 * point of integer money is lost if a float slips through and only surfaces as
 * a rounding discrepancy on an invoice weeks later.
 */
function assertMinor(value, label = "amount") {
  if (!Number.isInteger(value)) {
    throw new TypeError(
      `${label} must be an integer in minor units, received ${JSON.stringify(value)}`
    );
  }
  return value;
}

/**
 * Convert a major-unit amount (48.5 AED) to minor units (4850).
 *
 * Only for boundaries that genuinely hand over major units — seed data, an
 * import, a legacy row. Application code should already be holding minor units.
 */
function toMinor(major) {
  const n = Number(major);
  if (!Number.isFinite(n)) {
    throw new TypeError(`Cannot convert ${JSON.stringify(major)} to minor units`);
  }
  // Round rather than truncate: 48.55 * 100 is 4854.999... in binary floating
  // point, and truncating would quietly lose a fil on a subset of prices.
  return Math.round(n * FACTOR);
}

/** Convert minor units back to a major-unit number, for display only. */
function toMajor(minor) {
  return assertMinor(minor, "minor amount") / FACTOR;
}

/** Multiply a unit price by a whole quantity, staying in integers throughout. */
function lineTotal(unitPriceMinor, quantity) {
  assertMinor(unitPriceMinor, "unitPriceMinor");
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new TypeError(`quantity must be a non-negative integer, received ${quantity}`);
  }
  return unitPriceMinor * quantity;
}

/** Sum integer amounts. Empty sums to 0 rather than NaN. */
function sumMinor(amounts) {
  return amounts.reduce((total, amount) => total + assertMinor(amount), 0);
}

/**
 * The VAT already contained in a gross, VAT-inclusive amount.
 *
 * gross = net * 1.05, so vat = gross - gross / 1.05. Rounded to a whole fil;
 * the gross is authoritative, so this is a presentation figure and must never
 * be added back onto a total.
 */
function vatPortion(grossMinor) {
  assertMinor(grossMinor, "grossMinor");
  return grossMinor - Math.round(grossMinor / (1 + VAT_RATE));
}

/** Format minor units for humans, e.g. 4800 -> "AED 48.00". */
function formatMinor(minor, currency = DEFAULT_CURRENCY) {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency,
    minimumFractionDigits: MINOR_UNITS,
  }).format(toMajor(minor));
}

module.exports = {
  MINOR_UNITS,
  DEFAULT_CURRENCY,
  VAT_RATE,
  assertMinor,
  toMinor,
  toMajor,
  lineTotal,
  sumMinor,
  vatPortion,
  formatMinor,
};
