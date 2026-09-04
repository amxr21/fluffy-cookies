/**
 * Money on the client. Mirrors backend/lib/money.js — amounts crossing the API
 * are integers in minor units (fils) with an explicit currency.
 *
 * Prices are VAT-inclusive: what is shown is what is charged. `vatPortion`
 * exists to itemise the VAT already contained in a total, never to add to it.
 */

const MINOR_UNITS = 2;
const FACTOR = 10 ** MINOR_UNITS;

export const DEFAULT_CURRENCY = "AED";

/** UAE VAT rate, as a fraction of the net amount. */
const VAT_RATE = 0.05;

/** Convert major units to minor. Only for static data authored in major units. */
export function toMinor(major: number): number {
  return Math.round(major * FACTOR);
}

/** Multiply a unit price by a quantity, staying in integers. */
export function lineTotalMinor(unitPriceMinor: number, quantity: number): number {
  return unitPriceMinor * quantity;
}

/** Sum integer amounts; an empty list is 0, not NaN. */
export function sumMinor(amounts: number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}

/**
 * The VAT already inside a gross, VAT-inclusive amount.
 * Display only — the gross is what is charged.
 */
export function vatPortionMinor(grossMinor: number): number {
  return grossMinor - Math.round(grossMinor / (1 + VAT_RATE));
}

/**
 * Format minor units for display, e.g. 4800 -> "AED 48.00".
 *
 * Intl is used rather than hand-built string concatenation so the decimal
 * separator and currency placement stay correct if a second locale is ever
 * added — which for a UAE storefront is a matter of when, not if.
 */
export function formatMinor(
  minor: number,
  currency: string = DEFAULT_CURRENCY,
  locale = "en-AE"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: MINOR_UNITS,
  }).format(minor / FACTOR);
}
