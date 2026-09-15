/**
 * Delivery zones and shipping rates.
 *
 * Zones are modelled as DATA, not `if` statements — B8 is explicit about that,
 * and the reason is that "we now deliver to Dubai" should be a row, not a
 * deploy.
 *
 * Rates are server-authoritative like every other amount: the client says where
 * it is going, never what that costs. A shipping fee posted from the browser is
 * the same class of tampering as a posted price.
 */
const { assertMinor } = require("./money");

/**
 * UAE emirates, and what delivery costs to each.
 *
 * Fluffy is in Al Ain, so Al Ain is the cheap local rate and the rest of Abu
 * Dhabi emirate is a step up. The far emirates cost more because they are a
 * different day's driving.
 */
const ZONES = [
  { id: "al-ain", label: "Al Ain", emirates: ["Al Ain"], feeMinor: 1500 },
  { id: "abu-dhabi", label: "Abu Dhabi", emirates: ["Abu Dhabi"], feeMinor: 2500 },
  { id: "dubai-sharjah", label: "Dubai & Sharjah", emirates: ["Dubai", "Sharjah"], feeMinor: 3000 },
  {
    id: "northern",
    label: "Northern Emirates",
    emirates: ["Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"],
    feeMinor: 4000,
  },
];

/**
 * Spend this much and delivery is free.
 *
 * Evaluated against the subtotal AFTER discount, so a code cannot be used to
 * cross the threshold and then also take the discount — the standard asks for
 * this to be decided and written down rather than left implicit.
 */
const FREE_DELIVERY_THRESHOLD_MINOR = 15000;

/** Every emirate we deliver to, for populating a dropdown. */
const EMIRATES = ZONES.flatMap((zone) => zone.emirates).sort();

const findZone = (emirate) =>
  ZONES.find((zone) =>
    zone.emirates.some((e) => e.toLowerCase() === String(emirate || "").trim().toLowerCase())
  ) || null;

/**
 * What delivery costs for this order.
 *
 * Pickup is always free — there is nothing to deliver. An unrecognised emirate
 * is refused rather than defaulted: silently charging the Al Ain rate to drive
 * to Fujairah loses money on every such order.
 */
function quoteShipping({ fulfillment, emirate, subtotalAfterDiscountMinor }) {
  assertMinor(subtotalAfterDiscountMinor, "subtotalAfterDiscountMinor");

  if (fulfillment !== "Delivery") {
    return { ok: true, feeMinor: 0, zoneId: null, freeDelivery: false };
  }

  const zone = findZone(emirate);
  if (!zone) {
    return { ok: false, reason: "UNSUPPORTED_AREA" };
  }

  if (subtotalAfterDiscountMinor >= FREE_DELIVERY_THRESHOLD_MINOR) {
    return { ok: true, feeMinor: 0, zoneId: zone.id, freeDelivery: true };
  }

  return { ok: true, feeMinor: zone.feeMinor, zoneId: zone.id, freeDelivery: false };
}

/** How much more to spend for free delivery, for a nudge in the cart. */
function amountToFreeDelivery(subtotalAfterDiscountMinor) {
  return Math.max(0, FREE_DELIVERY_THRESHOLD_MINOR - subtotalAfterDiscountMinor);
}

module.exports = {
  ZONES,
  EMIRATES,
  FREE_DELIVERY_THRESHOLD_MINOR,
  findZone,
  quoteShipping,
  amountToFreeDelivery,
};
