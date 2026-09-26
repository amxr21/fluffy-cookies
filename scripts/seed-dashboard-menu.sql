-- ─────────────────────────────────────────────────────────────────────────────
-- Seed Fluffy's menu into the ADMIN DASHBOARD database.
--
-- Source: frontend/lib/menu.ts (3 categories, 16 products). Run this against
-- the dashboard's MySQL database, NOT the old fluffy-cookies backend database.
-- It is Fluffy-specific data, so it lives here and never in admin-dashboard.
--
-- BEFORE RUNNING
--   1. Images. Rename each local file to its product slug (the comment on each
--      row says which file is which), e.g. "image 12.jpg" becomes
--      "classic-chocolate-chip.jpg", then upload them all to Cloudinary.
--      Copy ONE image's URL and set @image_base to everything before the slug.
--      Every product's URL is then @image_base + slug, with no per-row pasting.
--      To override a single product, put a full URL in its last column. Leave
--      @image_base as '' to seed with no images; the storefront then shows
--      /images/cookie.png.
--   2. Adjust @opening_stock if you like. It applies at EVERY active selling
--      branch. The menu hides a product at any branch where it has no stock row.
--
-- SAFE TO RE-RUN: the script only inserts. A category or product whose slug
-- already exists is left exactly as it is, so edits made in the admin since
-- the last run are never overwritten. Because of that, re-running will NOT
-- add an image to a product that was seeded without one. Set that image in
-- the admin instead, which also records a catalogue version.
--
-- Everything runs in one transaction; any error rolls the whole seed back.
-- ─────────────────────────────────────────────────────────────────────────────

-- Everything before the slug, ending in "/". Drop the version segment
-- ("v1727.../") and the file extension. f_auto,q_auto serves WebP/AVIF at a
-- sensible quality instead of the original JPEG. Example:
--   'https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto/'
SET @image_base := '';
SET @opening_stock := 50;
-- UTC, not NOW(3): Prisma writes UTC, and NOW(3) is the server's local time
-- (see the note on Branch.isDefault in schema.prisma).
SET @now := UTC_TIMESTAMP(3);

START TRANSACTION;

-- ── Staging ─────────────────────────────────────────────────────────────────
-- The collation matches the dashboard's tables, so the joins below don't fail
-- with "Illegal mix of collations".

DROP TEMPORARY TABLE IF EXISTS seed_categories;
CREATE TEMPORARY TABLE seed_categories (
  slug VARCHAR(160) NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT INTO seed_categories (slug, name) VALUES
  ('cookies',                'Cookies'),
  ('stuffed-gourmet-sweets', 'Stuffed & Gourmet Sweets'),
  ('specialty-drinks',       'Specialty Drinks');

DROP TEMPORARY TABLE IF EXISTS seed_products;
CREATE TEMPORARY TABLE seed_products (
  slug          VARCHAR(220)  NOT NULL PRIMARY KEY,
  category_slug VARCHAR(160)  NOT NULL,
  name          VARCHAR(200)  NOT NULL,
  description   TEXT          NOT NULL,
  -- VAT-inclusive AED, which is how the storefront has always priced them.
  price         DECIMAL(10,2) NOT NULL,
  image_url     VARCHAR(512)  NOT NULL DEFAULT ''
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT INTO seed_products (slug, category_slug, name, description, price, image_url) VALUES
  -- Cookies
  ('classic-chocolate-chip',  'cookies', 'Classic Chocolate Chip',  'Golden edges, gooey center, packed with chips.',             48.00, '' /* images/cookies/image 12.jpg */),
  ('double-chocolate-fudge',  'cookies', 'Double Chocolate Fudge',  'Rich, soft, dark & milk chocolate mix.',                     40.00, '' /* images/cookies/image 13.jpg */),
  ('brownie-stuffed-cookie',  'cookies', 'Brownie Stuffed Cookie',  'Soft cookie dough with a molten brownie core.',              45.00, '' /* images/cookies/image 14.jpg */),
  ('lotus-bomb',              'cookies', 'Lotus Bomb',              'Caramelized cookie base with Biscoff drizzle.',              42.00, '' /* images/cookies/image 15.jpg */),
  ('nutella-heart',           'cookies', 'Nutella Heart',           'Vanilla dough with a Nutella center, topped with sea salt.', 44.00, '' /* images/cookies/image 16.jpg */),
  ('oreo-chunk',              'cookies', 'Oreo Chunk',              'Cookie & cream fusion with Oreo bits throughout.',           42.00, '' /* images/cookies/image 17.jpg */),

  -- Stuffed & Gourmet Sweets
  ('cookie-sandwiches',       'stuffed-gourmet-sweets', 'Cookie Sandwiches',   'Two cookies filled with vanilla or chocolate cream.',         38.00, '' /* images/sweets/image 12.jpg */),
  ('brookies',                'stuffed-gourmet-sweets', 'Brookies',            'Brownie + cookie layered squares, crispy top, chewy inside.', 40.00, '' /* images/sweets/image 13.jpg */),
  ('choco-dipped-treats',     'stuffed-gourmet-sweets', 'Choco-Dipped Treats', 'Dipped cookies or mini marshmallows, rotating flavors.',      46.00, '' /* images/sweets/image 14.jpg */),
  ('mini-cookie-box',         'stuffed-gourmet-sweets', 'Mini Cookie Box',     'Bite-sized assorted cookies, perfect for sharing.',           60.00, '' /* images/sweets/image 15.jpg */),

  -- Specialty Drinks
  ('iced-matcha-latte',       'specialty-drinks', 'Iced Matcha Latte',       'Earthy matcha with your choice of milk.',            56.00, '' /* images/drinkss/image 12.jpg */),
  ('strawberry-matcha-swirl', 'specialty-drinks', 'Strawberry Matcha Swirl', 'Layered with real strawberry purée.',                58.00, '' /* images/drinkss/image 13.jpg */),
  ('berry-cloud',             'specialty-drinks', 'Berry Cloud',             'Strawberry, blueberry, banana & oat milk.',          54.00, '' /* images/drinkss/image 14.jpg */),
  ('iced-spanish-latte',      'specialty-drinks', 'Iced Spanish Latte',      'Espresso, sweet milk, vanilla notes.',               50.00, '' /* images/drinkss/image 15.jpg */),
  ('caramel-cloud-latte',     'specialty-drinks', 'Caramel Cloud Latte',     'Smooth espresso with whipped caramel foam.',         52.00, '' /* images/drinkss/image 16.jpg */),
  ('vanilla-iced-latte',      'specialty-drinks', 'Vanilla Iced Latte',      'Chilled espresso with vanilla-infused sweet milk.',  48.00, '' /* images/drinkss/image 17.jpg */);

-- ── Categories ──────────────────────────────────────────────────────────────

INSERT INTO `categories` (`id`, `name`, `slug`, `is_active`, `parent_id`, `created_at`, `updated_at`)
SELECT CONCAT('fc_cat_', s.slug), s.name, s.slug, 1, NULL, @now, @now
FROM seed_categories s
WHERE NOT EXISTS (SELECT 1 FROM `categories` c WHERE c.`slug` = s.slug);

-- ── Products ────────────────────────────────────────────────────────────────
-- The category is joined BY SLUG, so a category that already existed under
-- another id is still used. Seeded products get the id 'fc_<slug>', and every
-- later step is limited to those ids. The seed never adds stock or versions
-- to a product it did not create.
--
-- catalogue_version starts at 1 because the baseline version row is written
-- below, as the 20260911100000 backfill migration does.

INSERT INTO `products` (
  `id`, `name`, `description`, `price`, `image_url`, `status`,
  `stock`, `catalogue_version`, `slug`, `category_id`, `created_at`, `updated_at`
)
SELECT
  CONCAT('fc_', s.slug), s.name, s.description, s.price,
  COALESCE(NULLIF(s.image_url, ''), IF(@image_base = '', NULL, CONCAT(@image_base, s.slug))),
  'ACTIVE',
  0, 1, s.slug, c.`id`, @now, @now
FROM seed_products s
JOIN `categories` c ON c.`slug` = s.category_slug
WHERE NOT EXISTS (SELECT 1 FROM `products` p WHERE p.`slug` = s.slug);

-- ── Opening stock at every active selling branch ───────────────────────────
-- Stock has three layers that must agree: the stock_movements log (the
-- truth), branch_stock (the per-branch running total) and products.stock (the
-- sum of both). stock.service.ts asserts that movements add up to stock, so
-- the movement is written instead of setting a number directly.
--
-- Movements go in first, guarded on branch_stock being absent. On a re-run
-- the branch_stock row exists, so neither is written twice.

INSERT INTO `stock_movements` (`id`, `branch_id`, `delta`, `reason`, `note`, `product_id`, `created_at`)
SELECT
  CONCAT('fc_open_', p.`id`, '_', b.`id`), b.`id`, @opening_stock, 'RECEIVED',
  'Opening stock (menu seed)', p.`id`, @now
FROM seed_products s
JOIN `products`   p  ON p.`id` = CONCAT('fc_', s.slug)
JOIN `branches`   b  ON b.`is_active` = 1 AND b.`is_selling_point` = 1
JOIN `businesses` bu ON bu.`id` = b.`business_id` AND bu.`is_active` = 1
WHERE @opening_stock > 0
  AND NOT EXISTS (
    SELECT 1 FROM `branch_stock` bs
    WHERE bs.`product_id` = p.`id` AND bs.`branch_id` = b.`id`
  );

-- Written even when @opening_stock is 0. Without this row the product does not
-- appear on that branch's menu at all. With it, the product shows as sold out.
INSERT INTO `branch_stock` (`id`, `product_id`, `branch_id`, `quantity`, `created_at`, `updated_at`)
SELECT
  CONCAT('fc_bs_', p.`id`, '_', b.`id`), p.`id`, b.`id`, @opening_stock, @now, @now
FROM seed_products s
JOIN `products`   p  ON p.`id` = CONCAT('fc_', s.slug)
JOIN `branches`   b  ON b.`is_active` = 1 AND b.`is_selling_point` = 1
JOIN `businesses` bu ON bu.`id` = b.`business_id` AND bu.`is_active` = 1
WHERE NOT EXISTS (
  SELECT 1 FROM `branch_stock` bs
  WHERE bs.`product_id` = p.`id` AND bs.`branch_id` = b.`id`
);

UPDATE `products` p
JOIN (
  SELECT `product_id`, SUM(`quantity`) AS qty
  FROM `branch_stock`
  GROUP BY `product_id`
) t ON t.`product_id` = p.`id`
JOIN seed_products s ON p.`id` = CONCAT('fc_', s.slug)
SET p.`stock` = t.qty;

-- ── Catalogue version baseline ─────────────────────────────────────────────
-- The same snapshot shape as the 20260911100000 backfill migration and
-- product-catalogue-version.service.ts's snapshotSchema. Without it the
-- product's history has no version 1 to restore to.

INSERT INTO `product_catalogue_versions` (
  `id`, `version`, `source`, `summary`, `snapshot`, `actor_id`,
  `actor_email`, `actor_role`, `product_id`, `created_at`
)
SELECT
  CONCAT('baseline-', p.`id`),
  1,
  'CREATE',
  'Initial catalogue baseline',
  JSON_OBJECT(
    'name', p.`name`,
    'sku', p.`sku`,
    'description', p.`description`,
    'price', CAST(p.`price` AS CHAR),
    'cost', IF(p.`cost` IS NULL, NULL, CAST(p.`cost` AS CHAR)),
    'imageUrl', p.`image_url`,
    'status', p.`status`,
    'lowStockThreshold', p.`low_stock_threshold`,
    'storageLocation', p.`storage_location`,
    'categoryId', p.`category_id`,
    'barcode', p.`barcode`,
    'weightKg', IF(p.`weight_kg` IS NULL, NULL, CAST(p.`weight_kg` AS CHAR)),
    'lengthCm', IF(p.`length_cm` IS NULL, NULL, CAST(p.`length_cm` AS CHAR)),
    'widthCm', IF(p.`width_cm` IS NULL, NULL, CAST(p.`width_cm` AS CHAR)),
    'heightCm', IF(p.`height_cm` IS NULL, NULL, CAST(p.`height_cm` AS CHAR)),
    'hsCode', p.`hs_code`,
    'countryOfOrigin', p.`country_of_origin`,
    'slug', p.`slug`,
    'metaTitle', p.`meta_title`,
    'metaDescription', p.`meta_description`,
    'tagIds', JSON_ARRAY(),
    'translations', JSON_ARRAY()
  ),
  NULL, NULL, NULL,
  p.`id`,
  @now
FROM seed_products s
JOIN `products` p ON p.`id` = CONCAT('fc_', s.slug)
WHERE NOT EXISTS (
  SELECT 1 FROM `product_catalogue_versions` v WHERE v.`product_id` = p.`id`
);

COMMIT;

DROP TEMPORARY TABLE IF EXISTS seed_products;
DROP TEMPORARY TABLE IF EXISTS seed_categories;

-- ── Check ───────────────────────────────────────────────────────────────────
-- Expect 16 rows. branches_stocked should equal your number of active selling
-- branches. If it is 0, the product will not appear on the storefront menu.
SELECT c.`name` AS category, p.`name`, p.`price`, p.`stock`,
       COUNT(bs.`id`) AS branches_stocked,
       p.`image_url` IS NOT NULL AS has_image
FROM `products` p
JOIN `categories` c ON c.`id` = p.`category_id`
LEFT JOIN `branch_stock` bs ON bs.`product_id` = p.`id`
WHERE p.`id` LIKE 'fc\_%'
GROUP BY p.`id`, c.`name`, p.`name`, p.`price`, p.`stock`, p.`image_url`
ORDER BY c.`name`, p.`name`;
