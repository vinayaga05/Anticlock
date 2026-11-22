/** Upload only the ten explicitly requested QA product images to the configured R2 bucket. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { R2ObjectStorageProvider } from '../src/media/R2ObjectStorageProvider.js';

const environment = process.argv[2];
if (!environment) throw new Error('Usage: tsx scripts/upload-shop-test-images.ts /path/to/.env.production');
config({ path: environment, quiet: true });
for (const key of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_BASE_URL']) {
  if (!process.env[key]) throw new Error(`Missing required configuration: ${key}`);
}
const source = await readFile(fileURLToPath(new URL('./seed-shop-test-catalog.sql', import.meta.url)), 'utf8');
const images = [...source.matchAll(/\(\d+, '(knock-test-[^']+)',[^\n]+\n\s*'(https:\/\/images\.unsplash\.com\/[^']+)'/g)];
if (images.length !== 10) throw new Error('Expected exactly ten QA product image sources');
const storage = new R2ObjectStorageProvider();
for (const [, slug, url] of images) {
  const key = `public/shop-test-catalog-v1/${slug}.jpg`;
  const response = await fetch(url!, { headers: { Accept: 'image/jpeg' }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/jpeg')) {
    throw new Error(`Image fetch failed for ${slug}: HTTP ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1_000 || bytes.length > 5_000_000) throw new Error(`Unexpected image size for ${slug}`);
  await storage.putObject({ bucket: 'public-media', key, body: bytes, contentType: 'image/jpeg' });
  const delivery = await storage.createDownloadUrl({ bucket: 'public-media', key, accessLevel: 'public' });
  if (!delivery) throw new Error(`No delivery URL for ${slug}`);
  // createDownloadUrl mints a signed GET; a HEAD request invalidates its signature.
  const check = await fetch(delivery, { headers: { Range: 'bytes=0-63' }, signal: AbortSignal.timeout(20_000) });
  if (!check.ok || !check.headers.get('content-type')?.startsWith('image/')) {
    throw new Error(`Uploaded image is not deliverable for ${slug}: HTTP ${check.status}`);
  }
  await check.body?.cancel();
  console.log(`${slug}: uploaded and authorized delivery HTTP ${check.status}`);
}
