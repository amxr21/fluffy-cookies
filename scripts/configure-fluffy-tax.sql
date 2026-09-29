-- Fluffy-specific pricing configuration (D1). Apply only to Fluffy's dashboard
-- database after deploying the pricesIncludeTax setting and order migration.
-- Menu prices already include 5% VAT. Other dashboard clients keep their default.
START TRANSACTION;
INSERT INTO settings (`key`, value, updated_at)
VALUES ('store.taxRate', CAST('5' AS JSON), UTC_TIMESTAMP(3)),
       ('store.pricesIncludeTax', CAST('true' AS JSON), UTC_TIMESTAMP(3)),
       ('store.deliveryZonesEnabled', CAST('true' AS JSON), UTC_TIMESTAMP(3)),
       ('storefront.hideStockCounts', CAST('true' AS JSON), UTC_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at);
INSERT INTO delivery_zones (id, code, name, fee, free_delivery_threshold, is_active, sort_order, created_at, updated_at)
VALUES ('fluffy-al-ain', 'al-ain', 'Al Ain', 15.00, 150.00, true, 0, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)),
       ('fluffy-abu-dhabi', 'abu-dhabi', 'Abu Dhabi', 25.00, 150.00, true, 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)),
       ('fluffy-dubai', 'dubai', 'Dubai', 30.00, 150.00, true, 2, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)),
       ('fluffy-sharjah', 'sharjah', 'Sharjah', 30.00, 150.00, true, 3, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)),
       ('fluffy-ajman', 'ajman', 'Ajman', 40.00, 150.00, true, 4, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)),
       ('fluffy-uaq', 'umm-al-quwain', 'Umm Al Quwain', 40.00, 150.00, true, 5, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)),
       ('fluffy-rak', 'ras-al-khaimah', 'Ras Al Khaimah', 40.00, 150.00, true, 6, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)),
       ('fluffy-fujairah', 'fujairah', 'Fujairah', 40.00, 150.00, true, 7, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE name = VALUES(name), fee = VALUES(fee), free_delivery_threshold = VALUES(free_delivery_threshold), is_active = VALUES(is_active), sort_order = VALUES(sort_order), updated_at = VALUES(updated_at);
COMMIT;
