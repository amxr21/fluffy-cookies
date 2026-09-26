-- Public order numbers become unguessable.
--
-- They were `FL${auto_increment}` — FL1001, FL1002 — so seeing one order number
-- gave you every other one. The tracking endpoint needs no login (deliberately,
-- so a gift recipient can track), which together made the order table walkable.
--
-- The column is already VARCHAR(40) and the new format is 10 characters, so no
-- type change is needed. Existing rows keep their old sequential numbers: they
-- are printed on confirmations customers already hold, and rewriting them would
-- break tracking for every open order. New orders get the new format, and the
-- rate limit added alongside this bounds what the old ones expose.

-- 001 already declared `order_number VARCHAR(40) UNIQUE`, so the uniqueness the
-- generator relies on (a collision must fail loudly, never attach two orders to
-- one number) is in place and no index is added here.
--
-- What changes is NOT NULL. The old flow inserted the row, derived the number
-- from the returned insertId, then UPDATEd it — so the column had to allow NULL
-- and every order existed untracked for a moment. Generating the number before
-- the INSERT removes that window, and this makes the schema say so.
ALTER TABLE orders
  MODIFY COLUMN order_number VARCHAR(40) NOT NULL;
