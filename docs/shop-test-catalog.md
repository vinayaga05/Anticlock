# Shop test catalog

This fixture adds ten **[TEST]** product listings for checking Shop browsing,
category filtering, product details, the cart badge and checkout UI. The listings
offer no fulfillment. Do not submit real orders for them.

The seed is deliberately separate from the broad application demo seed. It adds
no accounts or orders and does not update or delete existing catalog records.

1. Upload the ten illustrative image files to the app's configured R2 bucket:

   ```sh
   pnpm --filter @anticlock/api exec tsx scripts/upload-shop-test-images.ts ../../.env.production
   ```

   The helper accepts an explicit environment-file path and uses only the
   `public/shop-test-catalog-v1/` prefix. It checks each source JPEG and its
   authorized signed-GET delivery URL. It does not print credentials or URLs.

2. Run `apps/api/scripts/seed-shop-test-catalog.sql` with `psql` against the
   intended database, using `-v ON_ERROR_STOP=1`.

   The SQL runs inside one transaction, reuses published categories, creates
   missing category groups, and inserts exactly ten products with stock 25,
   prices in paise, compare-at prices and R2 image links. Stable slugs and media
   IDs make reruns idempotent. A conflicting non-fixture product slug aborts the
   transaction. Existing fixture items are not reset or restocked on rerun.

3. Verify the authenticated mobile `/v1/shop/products` response contains ten
   products with `metadata.seed = "knock-shop-test-catalog-v1"`,
   `metadata.isTestProduct = true`, and deliverable image URLs. Existing products
   may also be returned; do not replace or hide them.

To remove these listings from the live storefront after QA, archive only these
fixture-owned products in Admin, or run the following bounded update:

```sql
UPDATE products SET status = 'archived', review_status = 'archived', updated_at = now()
WHERE metadata->>'seed' = 'knock-shop-test-catalog-v1'
  AND metadata->>'isTestProduct' = 'true';
```

Archiving is reversible and preserves orders, images and catalog history. A seed
rerun intentionally refuses to republish archived fixture products; restore them
explicitly only when another QA round is intended.
