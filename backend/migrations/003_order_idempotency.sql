-- Idempotency keys for order placement.
--
-- A double-clicked "Place order", a retried request after a flaky connection,
-- or a second tab must not create a second order. The client sends a key it
-- generated for the attempt; a replay with the same key returns the original
-- order instead of placing another.
--
-- The key is scoped per user so one customer's key can never collide with or
-- expose another's order. Guests are keyed on NULL user_id, which MySQL treats
-- as distinct in a UNIQUE index — so guest keys do not collide with each other
-- either, and the row is looked up by (key, user) rather than relying on the
-- index for correctness.

CREATE TABLE IF NOT EXISTS order_idempotency (
  idempotency_key  VARCHAR(64) NOT NULL,
  user_id          INT NULL,
  order_id         INT NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idempotency_key),
  KEY idx_order_idempotency_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
