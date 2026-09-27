-- Fluffy-specific pricing configuration (D1). Apply only to Fluffy's dashboard
-- database after deploying the pricesIncludeTax setting and order migration.
-- Menu prices already include 5% VAT. Other dashboard clients keep their default.
START TRANSACTION;
INSERT INTO settings (`key`, value, updated_at)
VALUES ('store.taxRate', CAST('5' AS JSON), UTC_TIMESTAMP(3)),
       ('store.pricesIncludeTax', CAST('true' AS JSON), UTC_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at);
COMMIT;
