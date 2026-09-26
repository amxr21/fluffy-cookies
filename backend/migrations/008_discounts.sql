-- Discount codes.
--
-- The checkout form has always collected a code and the schema has always
-- accepted it — and no controller ever read it. A customer typing FLUFFY10 saw
-- no error and was charged full price. That is worse than not offering codes.
--
-- Every limit lives here rather than in application code, because a discount is
-- money: the rules have to be enforceable in one transaction against a locked
-- row, not spread across handlers that can be added later without them.

CREATE TABLE IF NOT EXISTS discounts (
  id                  INT AUTO_INCREMENT PRIMARY KEY,

  -- Stored uppercase; lookups uppercase first, so FLUFFY10 and fluffy10 are the
  -- same code rather than two.
  code                VARCHAR(32) NOT NULL,

  type                ENUM('percent','fixed') NOT NULL,
  -- Percent: whole points (10 = 10%). Fixed: minor units, same as every other
  -- amount in the system (see lib/money.js) — never a float.
  value               INT NOT NULL,

  -- Guards against a percentage code discounting a huge basket to nothing.
  max_discount_minor  INT NULL,
  min_subtotal_minor  INT NOT NULL DEFAULT 0,

  starts_at           TIMESTAMP NULL DEFAULT NULL,
  ends_at             TIMESTAMP NULL DEFAULT NULL,

  -- NULL means unlimited. `used_count` is maintained transactionally alongside
  -- redemption so the limit cannot be beaten by racing.
  usage_limit         INT NULL,
  per_user_limit      INT NULL DEFAULT 1,
  used_count          INT NOT NULL DEFAULT 0,

  active              TINYINT(1) NOT NULL DEFAULT 1,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_discounts_code (code),
  CONSTRAINT chk_discount_value_positive CHECK (value > 0),
  -- A percentage over 100 would produce a negative total.
  CONSTRAINT chk_discount_percent_range CHECK (type <> 'percent' OR value <= 100)
);

-- Who redeemed what, and on which order. This is what enforces per_user_limit
-- and what makes "why was this order cheaper" answerable months later.
CREATE TABLE IF NOT EXISTS discount_redemptions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  discount_id   INT NOT NULL,
  order_id      INT NOT NULL,
  user_id       INT NULL,

  -- Snapshotted, like every other amount on an order: editing the code later
  -- must not change what a past order says it discounted.
  amount_minor  INT NOT NULL,
  redeemed_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- One redemption per order. A retry that got as far as writing this row
  -- cannot double-count against the usage limit.
  UNIQUE KEY uq_redemption_order (order_id),
  KEY idx_redemption_user (discount_id, user_id),
  FOREIGN KEY (discount_id) REFERENCES discounts(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- The order keeps its own record of what was applied, so reading an order needs
-- no join and a deleted code cannot erase the discount from an invoice.
ALTER TABLE orders
  ADD COLUMN discount_code  VARCHAR(32) NULL AFTER total_minor,
  ADD COLUMN discount_minor INT NOT NULL DEFAULT 0 AFTER discount_code;
