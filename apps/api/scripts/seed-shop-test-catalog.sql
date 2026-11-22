-- Narrow, repeatable Shop QA catalog. Run against the intended database only:
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/scripts/seed-shop-test-catalog.sql
-- Creates no users, orders or unrelated demo records. Existing catalog is preserved.
-- Prices are integer paise. Every listing is visibly labelled TEST.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('knock-shop-test-catalog-v1'));

CREATE TEMP TABLE knock_shop_test_catalog (
  n integer PRIMARY KEY, slug text NOT NULL, name text NOT NULL,
  category_slug text NOT NULL, category_name text NOT NULL,
  price integer NOT NULL, compare_at_price integer NOT NULL,
  image_url text NOT NULL, description text NOT NULL
) ON COMMIT DROP;

INSERT INTO knock_shop_test_catalog VALUES
  (1, 'knock-test-premium-yoga-mat', '[TEST] Premium Yoga Mat', 'fitness', 'Fitness', 79900, 119900,
   'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?auto=format&fit=crop&w=800&h=800&q=85', 'Non-slip yoga mat with a comfortable cushioned surface and carrying strap.'),
  (2, 'knock-test-dumbbell-pair', '[TEST] Dumbbell Pair', 'fitness', 'Fitness', 149900, 199900,
   'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=800&h=800&q=85', 'Compact dumbbell pair for strength-training and home workout testing.'),
  (3, 'knock-test-sports-water-bottle', '[TEST] Sports Water Bottle', 'sports', 'Sports', 39900, 59900,
   'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=800&h=800&q=85', 'Reusable everyday water bottle for workouts, travel and office use.'),
  (4, 'knock-test-wireless-earbuds', '[TEST] Wireless Earbuds', 'electronics', 'Electronics', 129900, 199900,
   'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&h=800&q=85', 'Compact wireless earbuds with a portable charging case.'),
  (5, 'knock-test-over-ear-headphones', '[TEST] Over-Ear Headphones', 'electronics', 'Electronics', 199900, 299900,
   'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&h=800&q=85', 'Cushioned over-ear headphones for music and everyday listening.'),
  (6, 'knock-test-classic-watch', '[TEST] Classic Watch', 'electronics', 'Electronics', 99900, 149900,
   'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&h=800&q=85', 'Minimal everyday wristwatch with a clean easy-to-read dial.'),
  (7, 'knock-test-cotton-t-shirt', '[TEST] Cotton T-Shirt', 'garments', 'Garments', 49900, 79900,
   'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&h=800&q=85', 'Soft cotton crew-neck T-shirt with a versatile regular fit.'),
  (8, 'knock-test-running-shoes', '[TEST] Running Shoes', 'sports', 'Sports', 179900, 249900,
   'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&h=800&q=85', 'Lightweight lace-up sports shoes for everyday activity.'),
  (9, 'knock-test-ceramic-coffee-mug', '[TEST] Ceramic Coffee Mug', 'kitchen', 'Kitchen Appliances', 29900, 49900,
   'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=800&h=800&q=85', 'Reusable ceramic coffee mug with a comfortable handle.'),
  (10, 'knock-test-wooden-building-blocks', '[TEST] Wooden Building Blocks', 'games', 'Games & Toys', 69900, 99900,
   'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=800&h=800&q=85', 'Colorful building-block play set for product catalog testing.');

-- Do not take over an existing, unrelated product that happens to use a test slug.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM products p JOIN knock_shop_test_catalog t ON p.slug = t.slug
    WHERE p.metadata->>'seed' IS DISTINCT FROM 'knock-shop-test-catalog-v1'
  ) THEN
    RAISE EXCEPTION 'A test product slug belongs to an unrelated record; catalog unchanged';
  END IF;
END $$;

-- Reuse published categories by canonical slug/name. Only create missing groups.
INSERT INTO product_categories (name, slug, description, sort_order, status)
SELECT DISTINCT t.category_name, 'knock-test-' || t.category_slug,
       'Shop QA category for the explicitly labelled TEST catalog.', 900, 'published'
FROM knock_shop_test_catalog t
WHERE NOT EXISTS (
  SELECT 1 FROM product_categories c WHERE c.status = 'published'
    AND (lower(c.name) = lower(t.category_name)
      OR lower(c.slug) IN (t.category_slug, 'ecom.' || t.category_slug, 'ecom-' || t.category_slug,
                          'knock-test-' || t.category_slug)
      OR (t.category_slug = 'fitness' AND c.slug = 'fitness-equipment'))
)
ON CONFLICT (slug) DO NOTHING;

-- First run upload-shop-test-images.ts; these are actual R2 objects, not external rows.
-- Stable media IDs make reruns safe and prevent duplicate image rows.
INSERT INTO media_assets (id, kind, storage_provider, storage_key, bucket, mime_type,
                          original_filename, access_level, processing_status, moderation_status,
                          thumbnail_url)
SELECT ('d9b41001-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       'image', 'r2', 'public/shop-test-catalog-v1/' || slug || '.jpg', 'public-media', 'image/jpeg',
       slug || '.jpg', 'public', 'ready', 'not_required', NULL
FROM knock_shop_test_catalog
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (category_id, slug, name, description, price, compare_at_price, inventory,
                      status, requested_visibility, review_status, approved_at, metadata)
SELECT category.id, t.slug, t.name,
       'TEST PRODUCT — catalog and checkout UI testing only. No fulfillment is offered. ' || t.description,
       t.price, t.compare_at_price, 25, 'published', 'public', 'approved', now(),
       '{"seed":"knock-shop-test-catalog-v1","isTestProduct":true,"seller":"Knock Test Store"}'::jsonb
FROM knock_shop_test_catalog t
CROSS JOIN LATERAL (
  SELECT c.id FROM product_categories c WHERE c.status = 'published'
    AND (lower(c.name) = lower(t.category_name)
      OR lower(c.slug) IN (t.category_slug, 'ecom.' || t.category_slug, 'ecom-' || t.category_slug,
                          'knock-test-' || t.category_slug)
      OR (t.category_slug = 'fitness' AND c.slug = 'fitness-equipment'))
  ORDER BY (c.slug LIKE 'knock-test-%'), c.created_at, c.id LIMIT 1
) category
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_images (product_id, media_asset_id, alt, sort_order)
SELECT p.id, ('d9b41001-0000-4000-8000-' || lpad(t.n::text, 12, '0'))::uuid,
       t.name || ' — illustrative test product image', 0
FROM knock_shop_test_catalog t JOIN products p ON p.slug = t.slug
WHERE p.metadata->>'seed' = 'knock-shop-test-catalog-v1'
  AND NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id);

DO $$
BEGIN
  IF (SELECT count(*) FROM products p JOIN knock_shop_test_catalog t ON p.slug = t.slug
      JOIN product_categories c ON c.id = p.category_id
      WHERE p.metadata->>'seed' = 'knock-shop-test-catalog-v1'
        AND p.status = 'published' AND p.review_status = 'approved'
        AND p.requested_visibility = 'public' AND c.status = 'published'
        AND EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id)) <> 10 THEN
    RAISE EXCEPTION 'Expected exactly ten visible test products with images; catalog unchanged';
  END IF;
END $$;

SELECT p.id, p.slug, p.name, p.price, p.inventory, c.name AS category
FROM products p JOIN knock_shop_test_catalog t ON t.slug = p.slug
JOIN product_categories c ON c.id = p.category_id ORDER BY t.n;
COMMIT;
