/**
 * Assigns every request a correlation id, exposed as `req.id` and returned in
 * the `x-request-id` response header.
 *
 * The production debug loop this enables: a customer reports an error and reads
 * back the id shown in the UI, you filter the logs by it, and you have the full
 * story of that one request in order. Without it, "it broke around 3pm" is the
 * only lead.
 *
 * An inbound `x-request-id` is honoured so a trace survives a proxy or a call
 * from another service — but it is length-capped and stripped of anything
 * outside a conservative character set first. The value reaches log files and a
 * response header, so an unbounded client-controlled string is a log-injection
 * and header-splitting vector.
 */
const { randomUUID } = require("crypto");

const MAX_LENGTH = 64;
const SAFE = /[^A-Za-z0-9._-]/g;

function normalize(value) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(SAFE, "").slice(0, MAX_LENGTH);
  return cleaned.length ? cleaned : null;
}

module.exports = function requestId(req, res, next) {
  req.id = normalize(req.headers["x-request-id"]) || randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
};
