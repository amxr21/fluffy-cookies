-- Payments and refunds.
--
-- Cash and card-on-delivery needed no record beyond the order itself: the money
-- and the goods change hands together. An online payment does not — it is a
-- separate thing that can succeed, fail, be retried, or arrive minutes after
-- the customer closed the tab, so it needs its own row.

CREATE TABLE IF NOT EXISTS payments (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  order_id         INT NOT NULL,

  provider         VARCHAR(32) NOT NULL,
  -- The provider's own id (a Stripe PaymentIntent, say). UNIQUE because a
  -- webhook is delivered more than once by design, and the second delivery must
  -- find the existing row rather than create a duplicate.
  provider_ref     VARCHAR(255) NOT NULL,

  status           VARCHAR(32) NOT NULL DEFAULT 'pending',

  -- Minor units, like every other amount here (lib/money.js). Never a float.
  amount_minor     INT NOT NULL,
  currency         CHAR(3) NOT NULL DEFAULT 'AED',

  -- What the provider actually sent. Kept because a payment dispute months
  -- later is argued from the provider's record, not from our summary of it.
  raw_payload_json JSON NULL,

  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_payments_provider_ref (provider, provider_ref),
  KEY idx_payments_order (order_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Every webhook we have already processed.
--
-- Providers retry, and will deliver the same event twice. Without this, a
-- retried "payment succeeded" marks an order paid twice; a retried refund
-- refunds twice. The event id is the primary key, so a duplicate is refused by
-- the database rather than by remembering to check.
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id     VARCHAR(255) PRIMARY KEY,
  provider     VARCHAR(32) NOT NULL,
  event_type   VARCHAR(64) NOT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refunds (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  payment_id    INT NOT NULL,

  amount_minor  INT NOT NULL,
  reason        VARCHAR(255) NULL,
  status        VARCHAR(32) NOT NULL DEFAULT 'pending',
  provider_ref  VARCHAR(255) NULL,

  actor_id      INT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_refunds_payment (payment_id),
  CONSTRAINT chk_refund_positive CHECK (amount_minor > 0),
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);

-- The order's own view of payment, so reading an order needs no join.
ALTER TABLE orders
  ADD COLUMN payment_status VARCHAR(32) NOT NULL DEFAULT 'unpaid' AFTER payment;
