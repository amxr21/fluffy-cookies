/**
 * Pagination for list endpoints.
 *
 * Every list returned everything it had. The standard's wording is exact: an
 * unbounded `GET /orders` is a production incident waiting for the store to
 * succeed — it works fine until a customer has four hundred orders, and then it
 * is slow for everyone because the query holds the connection.
 *
 * The cap is enforced server-side, so a client asking for `limit=100000`
 * receives the maximum rather than the request it asked for.
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Read page params from a query string.
 *
 * Deliberately forgiving: a bad `limit` falls back to the default rather than
 * 400ing. This is a read, the caller gets a sensible page either way, and
 * rejecting would break a bookmarked URL for no gain.
 */
function readPageParams(query = {}) {
  const rawLimit = Number.parseInt(query.limit, 10);
  const rawOffset = Number.parseInt(query.offset, 10);

  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;

  return { limit, offset };
}

/**
 * Wrap rows in the list envelope.
 *
 * `hasMore` rather than a total count: counting every matching row on every
 * page is a second full scan, and "Next" only needs to know whether there IS
 * one. A total can be added later for a page-number UI if one is ever built.
 */
function paginated(rows, { limit, offset, total } = {}) {
  return {
    data: rows,
    page: {
      limit,
      offset,
      count: rows.length,
      hasMore: total != null ? offset + rows.length < total : rows.length === limit,
      ...(total != null ? { total } : {}),
    },
  };
}

/** Apply paging to an in-memory array — the file store's equivalent of LIMIT. */
function slice(rows, { limit, offset }) {
  return rows.slice(offset, offset + limit);
}

module.exports = { DEFAULT_LIMIT, MAX_LIMIT, readPageParams, paginated, slice };
