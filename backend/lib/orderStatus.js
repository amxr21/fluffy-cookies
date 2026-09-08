/**
 * Order status as a state machine.
 *
 * `status` was a mutable VARCHAR that only ever held "pending" — nothing wrote
 * anything else, so the four-phase tracker already shipped on the storefront
 * could never advance past step one.
 *
 * The rule from the build standard (invariant 7): declared legal transitions,
 * rejected at the service layer, with an append-only history. A status column
 * anyone can set to anything is not a state machine; it is a string that
 * happens to hold state-shaped values.
 *
 * The vocabulary here matches what the storefront's tracker already maps
 * (frontend/lib/orders.ts) so the UI needs no change to start working.
 */
const { badRequest, conflict } = require("../errors/AppError");

const STATUS = {
  PENDING: "pending",
  PREPARING: "preparing",
  READY: "ready",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

/** Where an order can go from each state. Empty means terminal. */
const TRANSITIONS = {
  [STATUS.PENDING]: [STATUS.PREPARING, STATUS.CANCELLED],
  [STATUS.PREPARING]: [STATUS.READY, STATUS.CANCELLED],
  // Cancellable up to hand-off: a customer who does not collect is a real case,
  // and the food still exists. After completion there is nothing to cancel.
  [STATUS.READY]: [STATUS.COMPLETED, STATUS.CANCELLED],
  [STATUS.COMPLETED]: [],
  [STATUS.CANCELLED]: [],
};

const ALL_STATUSES = Object.values(STATUS);

const isTerminal = (status) => (TRANSITIONS[status] || []).length === 0;

/** What an order in this state may become — for building an admin UI. */
const allowedNext = (status) => TRANSITIONS[status] || [];

/**
 * Check a proposed transition, throwing if it is not legal.
 *
 * Distinguishes three failures on purpose, because they mean different things
 * to whoever hits them:
 *   - unknown status        → 400, the caller sent nonsense
 *   - already in that state → 409, a double-click or a retry, not an error
 *     the operator should be told to fix
 *   - illegal move          → 409, with the legal moves named so an admin UI
 *     can say what IS possible rather than only what is not
 */
function assertTransition(from, to) {
  if (!ALL_STATUSES.includes(to)) {
    throw badRequest(
      `Unknown order status "${to}". Valid statuses: ${ALL_STATUSES.join(", ")}`
    );
  }

  if (from === to) {
    throw conflict(`This order is already ${to}`);
  }

  if (isTerminal(from)) {
    throw conflict(`This order is ${from} and cannot change state`);
  }

  if (!allowedNext(from).includes(to)) {
    throw conflict(
      `Cannot move an order from ${from} to ${to}. ` +
        `Allowed from ${from}: ${allowedNext(from).join(", ")}`
    );
  }
}

const canTransition = (from, to) =>
  !isTerminal(from) && from !== to && allowedNext(from).includes(to);

module.exports = {
  STATUS,
  ALL_STATUSES,
  TRANSITIONS,
  isTerminal,
  allowedNext,
  canTransition,
  assertTransition,
};
