-- Order status history, append-only.
--
-- `orders.status` alone answers "where is this order" but never "who moved it,
-- when, and from what". For a refund dispute or a customer complaint that is
-- the only useful record, and it cannot be reconstructed after the fact — the
-- previous value is simply gone once the column is overwritten.
--
-- Rows here are never updated or deleted. The current status stays on `orders`
-- so the common read needs no join; this table is the audit trail behind it.

CREATE TABLE IF NOT EXISTS order_events (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  order_id     INT NOT NULL,

  -- NULL `from_status` marks order creation, which comes from nowhere.
  from_status  VARCHAR(32) NULL,
  to_status    VARCHAR(32) NOT NULL,

  -- Who moved it. NULL means the system (placement, or a future automated
  -- transition) rather than a person. ON DELETE SET NULL because removing a
  -- staff account must not erase the history of what they did.
  actor_id     INT NULL,
  note         VARCHAR(500) NULL,

  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_order_events_order (order_id, created_at),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Backfill: every existing order gets its placement event, so the history is
-- complete rather than starting mid-life for orders that predate this table.
INSERT INTO order_events (order_id, from_status, to_status, created_at)
  SELECT id, NULL, status, created_at FROM orders;
