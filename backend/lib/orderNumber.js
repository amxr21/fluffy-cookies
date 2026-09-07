/**
 * Public order numbers.
 *
 * `FL${auto_increment}` made every order number guessable from any other one:
 * see FL1001, try FL1002. Combined with an unauthenticated tracking endpoint,
 * that is a customer-data scraper rather than a convenience.
 *
 * The standard's rule is "order numbers are not database IDs". These carry ~40
 * bits of entropy in 8 characters — enough that guessing is impractical at any
 * rate limit we would tolerate, while staying short enough to read down a phone
 * and type without frustration.
 */
const crypto = require("crypto");

/**
 * Crockford base32 without I, L, O and U: no character pairs a customer can
 * confuse when reading a number aloud or copying it off a screen, and no vowels
 * to accidentally spell a word.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const LENGTH = 8;
const PREFIX = "FL";

/** Matches what `generate` produces. Used to reject junk before a DB lookup. */
const ORDER_NUMBER_RE = new RegExp(`^${PREFIX}[${ALPHABET}]{${LENGTH}}$`);

/**
 * Generate a public order number.
 *
 * Uses rejection sampling rather than `% ALPHABET.length`: 256 is not a
 * multiple of 32 — it is here, but the guard keeps the distribution uniform if
 * the alphabet is ever edited, and a biased order number is a smaller keyspace
 * than it appears.
 */
function generateOrderNumber() {
  const max = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let out = "";
  while (out.length < LENGTH) {
    for (const byte of crypto.randomBytes(LENGTH)) {
      if (byte >= max) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === LENGTH) break;
    }
  }
  return PREFIX + out;
}

/**
 * Normalise what a customer typed: uppercase, strip spaces and dashes, and map
 * the characters the alphabet deliberately excludes onto what they were most
 * likely meant to be. Someone reading a number off a phone screen types O for
 * 0 and I for 1 constantly, and a "not found" for that is a support ticket.
 */
function normalizeOrderNumber(input) {
  if (typeof input !== "string") return "";

  const cleaned = input.trim().toUpperCase().replace(/[\s-]/g, "");

  // Substitute only in the random body. The FL prefix contains an L, which the
  // alphabet excludes — folding it too would rewrite every real order number to
  // F1... and 404 the lookup.
  if (!cleaned.startsWith(PREFIX)) return cleaned;

  const body = cleaned
    .slice(PREFIX.length)
    .replace(/[ILO]/g, (c) => ({ I: "1", L: "1", O: "0" })[c])
    .replace(/U/g, "V");

  return PREFIX + body;
}

function isValidOrderNumber(value) {
  return ORDER_NUMBER_RE.test(value);
}

module.exports = {
  ALPHABET,
  LENGTH,
  PREFIX,
  ORDER_NUMBER_RE,
  generateOrderNumber,
  normalizeOrderNumber,
  isValidOrderNumber,
};
