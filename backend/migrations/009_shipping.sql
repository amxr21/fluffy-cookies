-- Shipping fee on the order, and a GCC-shaped address.
--
-- The order recorded no delivery fee at all, so a delivered order's total did
-- not say what part of it was delivery. That matters for a refund (do you
-- refund the fee?) and for any revenue reporting later.
--
-- The address was a flat `address` + `city` string pair. B8 and B13 are
-- specific that GCC addressing does not fit a US-style street+ZIP form:
-- country -> emirate -> city/area -> building is the shape people actually
-- use, and there is no postcode to lean on.

ALTER TABLE orders
  ADD COLUMN shipping_minor INT NOT NULL DEFAULT 0 AFTER discount_minor,
  -- Which zone rule produced the fee. Snapshotted, so re-pricing zones later
  -- cannot change what a past order says it charged for delivery.
  ADD COLUMN shipping_zone VARCHAR(32) NULL AFTER shipping_minor;
