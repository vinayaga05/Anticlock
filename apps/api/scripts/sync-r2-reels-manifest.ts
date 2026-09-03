/**
 * List MP4 objects in the R2 "reels" bucket and sync the mobile manifest +
 * publish reels-manifest.json to the public r2.dev URL for the app to fetch.
 *
 * Usage:
 *   pnpm --filter @anticlock/api r2:sync-reels
 *   pnpm --filter @anticlock/api r2:sync-reels -- --prefix canva/
 *   pnpm --filter @anticlock/api r2:sync-reels -- --keys "clip-a.mp4,clip-b.mp4"
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const MANIFEST_PATH = join(
  REPO_ROOT,
  'apps/mobile/src/shared/data/cloudflare-videos.manifest.json',
);
const PUBLIC_MANIFEST_KEY = 'reels-manifest.json';

type ManifestVideo = {
  id: string;
  title: string;
  objectKey: string;
  localFile: string;
  streamUid: string | null;
  playbackUrl: string;
  thumbnailUrl: string | null;
};

type Manifest = {
  version: number;
  updatedAt: string;
  source: string;
  remoteEnabled: boolean;
  publicBaseUrl: string;
  videos: ManifestVideo[];
};

function slugFromKey(key: string) {
  return basename(key, '.mp4')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function titleFromKey(key: string) {
  return basename(key, '.mp4').replace(/[-_]+/g, ' ').trim();
}

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
      'Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in apps/api/.env',
    );
  }

  return { accountId, accessKeyId, secretAccessKey };
}

function r2Endpoint(accountId: string) {
  const configured = process.env.R2_ENDPOINT?.trim();
  if (configured) return configured.replace(/\/$/, '').replace(/\/reels$/i, '');
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function createClient() {
  const { accountId, accessKeyId, secretAccessKey } = resolveR2Credentials();
  return new S3Client({
    region: 'auto',
    endpoint: r2Endpoint(accountId),
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function listMp4Keys(
  client: S3Client,
  bucket: string,
  prefix?: string,
): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const obj of page.Contents ?? []) {
      const key = obj.Key ?? '';
      if (/\.mp4$/i.test(key) && key !== PUBLIC_MANIFEST_KEY) {
        keys.push(key);
      }
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  return keys.sort();
}

function loadManifest(): Manifest {
  if (readFileSync(MANIFEST_PATH, 'utf8')) {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
  }
  throw new Error('Manifest missing');
}

function buildManifest(keys: string[], publicBase: string): Manifest {
  const videos: ManifestVideo[] = keys.map(key => {
    const slug = slugFromKey(key);
    return {
      id: `r2-${slug}`,
      title: titleFromKey(key),
      objectKey: key,
      localFile: basename(key),
      streamUid: null,
      playbackUrl: `${publicBase}/${key.split('/').map(encodeURIComponent).join('/')}`,
      thumbnailUrl: null,
    };
  });

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: 'r2-reels-bucket',
    remoteEnabled: videos.length > 0,
    publicBaseUrl: publicBase,
    videos,
  };
}

async function publishPublicManifest(
  client: S3Client,
  bucket: string,
  manifest: Manifest,
) {
  const body = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: PUBLIC_MANIFEST_KEY,
      Body: body,
      ContentType: 'application/json',
      CacheControl: 'public, max-age=60',
    }),
  );
  console.log(`Published ${PUBLIC_MANIFEST_KEY} to bucket`);
}

async function main() {
  const bucket = process.env.R2_BUCKET_PUBLIC?.trim() ?? 'reels';
  const publicBase = (
    process.env.R2_PUBLIC_BASE_URL?.trim() ??
    'https://pub-27960762dc094de6aef7fc922fec002a.r2.dev'
  ).replace(/\/$/, '');

  const args = process.argv.slice(2);
  const keysIdx = args.indexOf('--keys');
  const prefixIdx = args.indexOf('--prefix');
  const prefix =
    prefixIdx >= 0 ? args[prefixIdx + 1]?.replace(/\/?$/, '/') : undefined;
  let keys: string[] = [];

  const client = createClient();

  if (keysIdx >= 0) {
    const raw = args[keysIdx + 1];
    if (!raw) throw new Error('--keys requires a comma-separated list');
    keys = raw.split(',').map(k => k.trim()).filter(Boolean);
    console.log(`Using ${keys.length} manual key(s)`);
  } else {
    const scope = prefix ? `prefix "${prefix}"` : 'entire bucket';
    console.log(`Listing .mp4 objects in bucket "${bucket}" (${scope})…`);
    keys = await listMp4Keys(client, bucket, prefix);
    console.log(`Found ${keys.length} video(s)`);
  }

  if (!keys.length) {
    console.error(
      'No videos found. Upload MP4 files to the reels bucket in Cloudflare, or pass --keys "file.mp4"',
    );
    process.exit(1);
  }

  const manifest = buildManifest(keys, publicBase);
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${MANIFEST_PATH}`);

  for (const v of manifest.videos) {
    console.log(`  • ${v.title} → ${v.playbackUrl}`);
  }

  await publishPublicManifest(client, bucket, manifest);
  console.log(`\n✓ Play tab will load from ${publicBase}/${PUBLIC_MANIFEST_KEY}`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
