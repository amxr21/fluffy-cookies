/**
 * Discount validation and arithmetic.
 *
 * Every rule is checked server-side against the stored row. The client sends a
 * code and nothing else — never an amount, never a percentage. B10.4 lists
 * discount abuse as its own class of business-logic attack precisely because
 * the naive version trusts what the browser says the discount is worth.
 */
const { assertMinor } = require("./money");

/** Reasons a code can fail. Kept as codes so the caller decides the wording. */
const REJECT = {
  NOT_FOUND: "NOT_FOUND",
  INACTIVE: "INACTIVE",
  NOT_STARTED: "NOT_STARTED",
  EXPIRED: "EXPIRED",
  MIN_SUBTOTAL: "MIN_SUBTOTAL",
  USAGE_LIMIT: "USAGE_LIMIT",
  PER_USER_LIMIT: "PER_USER_LIMIT",
};

/** Normalise what a customer typed, so FLUFFY10 and " fluffy10 " are one code. */
function normalizeCode(input) {
  if (typeof input !== "string") return "";
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Work out what a discount is worth against a subtotal.
 *
 * Integer arithmetic throughout, and clamped so a discount can never exceed the
 * subtotal — a total below zero would mean paying the customer.
 */
function computeDiscountMinor(discount, subtotalMinor) {
  assertMinor(subtotalMinor, "subtotalMinor");

  let amount;
  if (discount.type === "percent") {
    // Rounded, not truncated: a fil either way, but consistently.
    amount = Math.round((subtotalMinor * discount.value) / 100);
  } else {
    amount = discount.value;
  }

  if (discount.max_discount_minor != null) {
    amount = Math.min(amount, discount.max_discount_minor);
  }

  return Math.max(0, Math.min(amount, subtotalMinor));
}

/**
 * Check every rule. Returns `{ ok, reason?, discountMinor? }` rather than
 * throwing, so the caller can answer a "check this code" request and a
 * "place this order" request from the same logic.
 *
 * `now` is injectable so window tests do not depend on the wall clock.
 */
function validateDiscount({ discount, subtotalMinor, userRedemptions = 0, now = new Date() }) {
  if (!discount) return { ok: false, reason: REJECT.NOT_FOUND };
  if (!discount.active) return { ok: false, reason: REJECT.INACTIVE };

  if (discount.starts_at && new Date(discount.starts_at) > now) {
    return { ok: false, reason: REJECT.NOT_STARTED };
  }
  if (discount.ends_at && new Date(discount.ends_at) < now) {
    return { ok: false, reason: REJECT.EXPIRED };
  }

  if (subtotalMinor < (discount.min_subtotal_minor || 0)) {
    return {
      ok: false,
      reason: REJECT.MIN_SUBTOTAL,
      minSubtotalMinor: discount.min_subtotal_minor,
    };
  }

  if (discount.usage_limit != null && discount.used_count >= discount.usage_limit) {
    return { ok: false, reason: REJECT.USAGE_LIMIT };
  }

  if (discount.per_user_limit != null && userRedemptions >= discount.per_user_limit) {
    return { ok: false, reason: REJECT.PER_USER_LIMIT };
  }

  return { ok: true, discountMinor: computeDiscountMinor(discount, subtotalMinor) };
}

/**
 * Customer-facing wording for a rejection.
 *
 * Deliberately vague about WHY an unknown code failed: a fast endpoint that
 * distinguishes "no such code" from "expired" is a code-guessing oracle
 * (B10.4). A limit the customer can act on is worth naming; the existence of a
 * code is not.
 */
function rejectionMessage(reason) {
  switch (reason) {
    case REJECT.MIN_SUBTOTAL:
      return "Your order doesn't reach the minimum for this code yet.";
    case REJECT.PER_USER_LIMIT:
      return "You've already used this code.";
    default:
      return "That code isn't valid.";
  }
}

module.exports = {
  REJECT,
  normalizeCode,
  computeDiscountMinor,
  validateDiscount,
  rejectionMessage,
};
