-- Money becomes integer minor units (fils), with an explicit currency.
--
-- DECIMAL(10,2) read back through mysql2's `decimalNumbers: true` arrives as a
-- JS float, and order totals were accumulated with `total += price * qty`. Money
-- must never be a float: 0.1 + 0.2 is the classic example, and at scale it shows
-- up as invoices that disagree with the sum of their own lines.
--
-- Prices are VAT-INCLUSIVE (UAE 5%), so these columns hold the GROSS amount the
-- customer pays. There is deliberately no net or VAT column: VAT is derivable
-- (vat = gross - gross / 1.05) and is a presentation/invoice concern.
--
-- AED has 2 minor units, so 48.00 AED becomes 4800 fils.

-- --- products -------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN price_minor INT NOT NULL DEFAULT 0 AFTER price,
  ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'AED' AFTER price_minor;

UPDATE products SET price_minor = ROUND(price * 100);

ALTER TABLE products DROP COLUMN price;

-- --- orders ---------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN total_minor INT NOT NULL DEFAULT 0 AFTER total,
  ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'AED' AFTER total_minor;

UPDATE orders SET total_minor = ROUND(total * 100);

ALTER TABLE orders DROP COLUMN total;

-- --- order_items ----------------------------------------------------------
-- There is no `price` column here to convert: 001 never created one, and the
-- insert only ever supplied order_id, product_id and quantity. Order lines
-- carried no money at all, which is the gap the snapshot columns below close.
--
-- Snapshot columns: an order line must keep what was actually charged and what
-- the product was called at the time. Joining live to `products` for display
-- means editing a product silently rewrites every past invoice.
ALTER TABLE order_items
  ADD COLUMN unit_price_minor INT NOT NULL DEFAULT 0 AFTER quantity,
  ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'AED' AFTER unit_price_minor,
  ADD COLUMN name_snapshot VARCHAR(255) NOT NULL DEFAULT '' AFTER currency;

-- Backfill existing lines from the live product, which is the best available
-- record for orders placed before snapshots existed. New orders write their own.
UPDATE order_items oi
  JOIN products p ON p.id = oi.product_id
  SET oi.unit_price_minor = p.price_minor,
      oi.name_snapshot    = p.name;

-- Indexes on the columns the storefront and admin actually filter and sort by.
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_created_at ON orders (created_at);
