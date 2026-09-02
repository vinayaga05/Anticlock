/**
 * Upload Canva MP4s to R2 (optional) and register them as published Reels in Postgres.
 *
 * Usage (on VPS, from repo root):
 *   docker compose --env-file .env.production \
 *     -f docker-compose.production.yml \
 *     -f docker-compose.traefik.override.yml \
 *     run --rm --no-deps \
 *     -v "$(pwd)/assets/canva-exports:/canva:ro" \
 *     api node dist/seed/importR2Clips.js --upload-dir /canva
 *
 * Import objects already in R2 only:
 *   docker compose ... exec api node dist/seed/importR2Clips.js
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { eq } from 'drizzle-orm';
import { db, sql } from '../db/client.js';
import { mediaAssets, reels, users } from '../db/schema.js';
import { r2PublicDeliveryUrl } from '../media/R2ObjectStorageProvider.js';

const R2_PREFIX = 'canva';

type ClipMeta = {
  title: string;
  caption: string;
  creatorName: string;
  category: string;
  order: number;
};

const CANVA_META: Record<string, ClipMeta> = {
  'yoga-flow.mp4': {
    title: 'Yoga flow',
    caption: 'Morning stretch routine to start your day',
    creatorName: 'wellness.studio',
    category: 'Fitness',
    order: 10,
  },
  'fitness-reel.mp4': {
    title: 'Quick fitness circuit',
    caption: 'Five moves you can do anywhere',
    creatorName: 'fit.ananya',
    category: 'Fitness',
    order: 11,
  },
  'health-tips.mp4': {
    title: 'Health tips',
    caption: 'Small habits that add up over time',
    creatorName: 'dr.remya',
    category: 'Health',
    order: 12,
  },
};

function resolveR2Credentials() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  let accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  let secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();

  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if ((!accessKeyId || !secretAccessKey) && apiToken?.startsWith('cfat_')) {
    accessKeyId = process.env.CLOUDFLARE_API_TOKEN_ID?.trim();
    if (accessKeyId) {
      secretAccessKey = createHash('sha256').update(apiToken).digest('hex');
    }
  }

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in .env.production',
    );
  }

  return { accountId, accessKeyId, secretAccessKey };
}

function r2Endpoint(accountId: string) {
  const configured = process.env.R2_ENDPOINT?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function titleFromFilename(file: string) {
  return basename(file, '.mp4').replace(/[-_]+/g, ' ').trim();
}

function metaForKey(key: string): ClipMeta {
  const file = basename(key);
  return (
    CANVA_META[file] ?? {
      title: titleFromFilename(file),
      caption: titleFromFilename(file),
      creatorName: 'anticlock',
      category: 'Clips',
      order: 100,
    }
  );
}

async function resolveAdminUserId() {
  const [row] = await db.select({ id: users.id }).from(users).limit(1);
  if (!row) {
    throw new Error('No admin user in database — run seed first');
  }
  return row.id;
}

async function uploadCanvaDir(client: S3Client, bucket: string, dir: string) {
  const files = readdirSync(dir)
    .filter(name => name.toLowerCase().endsWith('.mp4'))
    .sort();

  if (!files.length) {
    console.log(`No MP4 files in ${dir}`);
    return;
  }

  for (const file of files) {
    const path = join(dir, file);
    const key = `${R2_PREFIX}/${file}`;
    const body = readFileSync(path);
    console.log(`Uploading ${file} → r2://${bucket}/${key}`);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: 'video/mp4',
        CacheControl: 'public, max-age=31536000',
      }),
    );
  }
}

async function listMp4Keys(client: S3Client, bucket: string) {
  const keys: string[] = [];
  let token: string | undefined;

  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: token,
      }),
    );
    for (const obj of res.Contents ?? []) {
      const key = obj.Key?.trim();
      if (!key || !key.toLowerCase().endsWith('.mp4')) continue;
      keys.push(key);
    }
    token = res.NextContinuationToken;
  } while (token);

  return keys.sort();
}

async function upsertPublishedReel(
  adminId: string,
  bucket: string,
  key: string,
) {
  if (!r2PublicDeliveryUrl(key)) {
    throw new Error(
      `R2_PUBLIC_BASE_URL is not set — cannot publish ${key}`,
    );
  }

  const meta = metaForKey(key);
  const [existingMedia] = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.storageKey, key))
    .limit(1);

  let mediaId = existingMedia?.id;
  if (!mediaId) {
    const [asset] = await db
      .insert(mediaAssets)
      .values({
        kind: 'video',
        storageProvider: 'r2',
        storageKey: key,
        bucket,
        mimeType: 'video/mp4',
        accessLevel: 'public',
        processingStatus: 'ready',
        moderationStatus: 'not_required',
        durationMs: 60_000,
        originalFilename: basename(key),
        createdBy: adminId,
      })
      .returning();
    mediaId = asset!.id;
    console.log(`  media asset created: ${mediaId}`);
  } else {
    console.log(`  media asset exists: ${mediaId}`);
  }

  const [existingReel] = await db
    .select()
    .from(reels)
    .where(eq(reels.mediaId, mediaId))
    .limit(1);

  if (existingReel) {
    await db
      .update(reels)
      .set({
        status: 'published',
        moderationStatus: 'clear',
        contentMode: 'standard',
        isSample: false,
        publishedAt: existingReel.publishedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reels.id, existingReel.id));
    console.log(`  reel updated (published): ${existingReel.id}`);
    return;
  }

  const [existingByTitle] = await db
    .select()
    .from(reels)
    .where(eq(reels.title, meta.title))
    .limit(1);

  if (existingByTitle) {
    await db
      .update(reels)
      .set({
        mediaId,
        status: 'published',
        moderationStatus: 'clear',
        contentMode: 'standard',
        isSample: false,
        publishedAt: existingByTitle.publishedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reels.id, existingByTitle.id));
    console.log(`  reel linked + published: ${existingByTitle.id}`);
    return;
  }

  const [reel] = await db
    .insert(reels)
    .values({
      title: meta.title,
      caption: meta.caption,
      creatorName: meta.creatorName,
      category: meta.category,
      status: 'published',
      moderationStatus: 'clear',
      contentMode: 'standard',
      isSample: false,
      displayOrder: meta.order,
      mediaId,
      createdBy: adminId,
      publishedAt: new Date(),
    })
    .returning();
  console.log(`  reel created (published): ${reel!.id}`);
}

async function main() {
  const uploadDirArg = process.argv.find((_, i, arr) => arr[i - 1] === '--upload-dir');
  const bucket = process.env.R2_BUCKET_PUBLIC?.trim() ?? 'reels';
  const { accountId, accessKeyId, secretAccessKey } = resolveR2Credentials();

  const client = new S3Client({
    region: 'auto',
    endpoint: r2Endpoint(accountId),
    credentials: { accessKeyId, secretAccessKey },
  });

  await client.send(new HeadBucketCommand({ Bucket: bucket }));

  if (uploadDirArg) {
    const stat = statSync(uploadDirArg);
    if (!stat.isDirectory()) {
      throw new Error(`--upload-dir must be a directory: ${uploadDirArg}`);
    }
    await uploadCanvaDir(client, bucket, uploadDirArg);
  }

  const keys = await listMp4Keys(client, bucket);
  if (!keys.length) {
    console.log('No MP4 objects found in R2 bucket.');
    await sql.end({ timeout: 5 });
    return;
  }

  console.log(`Found ${keys.length} MP4 object(s) in R2:`);
  const adminId = await resolveAdminUserId();

  for (const key of keys) {
    console.log(`\n→ ${key}`);
    console.log(`  playback: ${r2PublicDeliveryUrl(key)}`);
    await upsertPublishedReel(adminId, bucket, key);
  }

  console.log('\nDone. Verify: curl -sk https://api.anticlock.online/v1/reels');
  await sql.end({ timeout: 5 });
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
