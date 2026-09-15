-- Stock, so an item can sell out.
--
-- There was no inventory at all: every product was infinitely orderable. For a
-- bakery working from daily batches that is an operational failure long before
-- it is a data one — the shop takes fifty orders for twenty cookies and finds
-- out at collection time.
--
-- Two columns, not one. `on_hand` is what physically exists; `reserved` is what
-- is spoken for by placed-but-not-yet-collected orders. Available is derived
-- (on_hand - reserved) and never stored, so the two can never disagree.

CREATE TABLE IF NOT EXISTS inventory (
  product_id           INT PRIMARY KEY,
  on_hand              INT NOT NULL DEFAULT 0,
  reserved             INT NOT NULL DEFAULT 0,
  low_stock_threshold  INT NOT NULL DEFAULT 5,

  -- Products a bakery makes to order rather than from a batch. Skips the stock
  -- check entirely instead of forcing someone to type a fake number every day.
  track_stock          TINYINT(1) NOT NULL DEFAULT 1,

  updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Guards the invariant directly: no code path may reserve more than exists,
  -- or drive either figure negative. A bug here fails loudly at the database
  -- rather than quietly overselling.
  CONSTRAINT chk_inventory_non_negative CHECK (on_hand >= 0 AND reserved >= 0),
  CONSTRAINT chk_inventory_reserved_le_on_hand CHECK (reserved <= on_hand),

  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Append-only movement log. Stock is derived from reality; this says why it
-- changed and who changed it, which a bare counter cannot.
CREATE TABLE IF NOT EXISTS inventory_ledger (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  product_id  INT NOT NULL,

  -- Signed: +12 for a morning batch, -1 for a sale, +1 for a cancellation.
  delta       INT NOT NULL,
  reason      VARCHAR(32) NOT NULL,

  -- What caused it, so a movement can be traced back to an order.
  ref_type    VARCHAR(32) NULL,
  ref_id      VARCHAR(64) NULL,

  actor_id    INT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_inventory_ledger_product (product_id, created_at),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Every existing product gets a row, so a missing row always means "product
-- added but stock never set up" rather than "product predates this table".
--
-- track_stock defaults to 0 for the backfill on purpose: turning tracking ON
-- for a product nobody has counted yet would make it instantly unorderable.
-- Enable it per product once a real count exists.
INSERT INTO inventory (product_id, on_hand, reserved, track_stock)
  SELECT id, 0, 0, 0 FROM products;
