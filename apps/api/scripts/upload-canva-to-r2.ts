/**
 * Upload Canva-export MP4s to Cloudflare R2 and update the mobile manifest.
 *
 * Requires R2 enabled on the Cloudflare account + API token with R2 write access.
 *
 * Usage:
 *   pnpm --filter @anticlock/api r2:upload-canva
 *   pnpm --filter @anticlock/api r2:upload-canva -- ../../assets/canva-exports/yoga-flow.mp4
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const DEFAULT_EXPORTS_DIR = join(REPO_ROOT, 'assets/canva-exports');
const MANIFEST_PATH = join(
  REPO_ROOT,
  'apps/mobile/src/shared/data/cloudflare-videos.manifest.json',
);
const R2_PREFIX = 'canva';

type ManifestVideo = {
  id: string;
  title: string;
  objectKey: string;
  localFile: string;
  streamUid: string | null;
  playbackUrl: string | null;
  thumbnailUrl: string | null;
};

type Manifest = {
  version: number;
  updatedAt: string;
  source: string;
  remoteEnabled?: boolean;
  publicBaseUrl?: string;
  videos: ManifestVideo[];
};

type CfApiResult<T> = {
  success: boolean;
  errors?: { code?: number; message: string }[];
  result?: T;
};

function slugFromFilename(file: string) {
  return basename(file, '.mp4')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function resolveR2Credentials() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  let accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  let secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();

  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if ((!accessKeyId || !secretAccessKey) && apiToken) {
    accessKeyId = process.env.CLOUDFLARE_API_TOKEN_ID?.trim();
    if (!accessKeyId) {
      throw new Error(
        'Set R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY, or CLOUDFLARE_API_TOKEN + CLOUDFLARE_API_TOKEN_ID',
      );
    }
    secretAccessKey = createHash('sha256').update(apiToken).digest('hex');
  }

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing R2 credentials. See assets/canva-exports/README.md',
    );
  }

  return { accountId, accessKeyId, secretAccessKey };
}

function r2Endpoint(accountId: string) {
  const configured = process.env.R2_ENDPOINT?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function cfFetch<T>(path: string, init?: RequestInit) {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (!token || !accountId) {
    throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID required');
  }
  return fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    },
  ).then(async res => {
    const json = (await res.json()) as CfApiResult<T>;
    if (!json.success) {
      const msg =
        json.errors?.map(e => e.message).join('; ') ||
        `Cloudflare API error (${res.status})`;
      throw new Error(msg);
    }
    return json.result as T;
  });
}

function loadManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      source: 'canva-exports',
      videos: [],
    };
  }
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
}

function saveManifest(manifest: Manifest) {
  manifest.updatedAt = new Date().toISOString();
  manifest.source = 'canva-exports-r2';
  manifest.remoteEnabled = true;
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nWrote manifest → ${MANIFEST_PATH}`);
}

function upsertVideo(manifest: Manifest, entry: ManifestVideo) {
  const idx = manifest.videos.findIndex(v => v.id === entry.id);
  if (idx >= 0) manifest.videos[idx] = entry;
  else manifest.videos.push(entry);
}

async function ensureBucket(bucket: string) {
  try {
    await cfFetch(`/r2/buckets/${encodeURIComponent(bucket)}`);
    console.log(`Bucket "${bucket}" exists`);
  } catch {
    console.log(`Creating bucket "${bucket}"…`);
    await cfFetch('/r2/buckets', {
      method: 'POST',
      body: JSON.stringify({ name: bucket, locationHint: 'apac' }),
    });
  }
}

async function ensurePublicR2Dev(bucket: string): Promise<string> {
  const configured = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const current = await cfFetch<{ domain?: string; enabled?: boolean }>(
    `/r2/buckets/${encodeURIComponent(bucket)}/domains/managed`,
  );

  let domain = current?.domain;
  if (!current?.enabled) {
    console.log('Enabling r2.dev public access…');
    const updated = await cfFetch<{ domain?: string }>(
      `/r2/buckets/${encodeURIComponent(bucket)}/domains/managed`,
      {
        method: 'PUT',
        body: JSON.stringify({ enabled: true }),
      },
    );
    domain = updated?.domain ?? domain;
  }

  if (!domain) {
    throw new Error(
      'Could not resolve r2.dev domain. Set R2_PUBLIC_BASE_URL in apps/api/.env',
    );
  }

  const base = domain.startsWith('http') ? domain : `https://${domain}`;
  console.log(`Public base: ${base}`);
  return base.replace(/\/$/, '');
}

function collectMp4Paths(args: string[]): string[] {
  const files: string[] = [];
  for (const arg of args) {
    const path = resolve(arg);
    if (!existsSync(path)) {
      console.warn(`Skipping missing path: ${path}`);
      continue;
    }
    const stat = statSync(path);
    if (stat.isDirectory()) {
      for (const name of readdirSync(path)) {
        if (name.toLowerCase().endsWith('.mp4')) {
          files.push(join(path, name));
        }
      }
    } else if (path.toLowerCase().endsWith('.mp4')) {
      files.push(path);
    }
  }
  return files.sort();
}

async function uploadFile(
  client: S3Client,
  bucket: string,
  publicBase: string,
  filePath: string,
): Promise<ManifestVideo> {
  const localFile = basename(filePath);
  const key = `${R2_PREFIX}/${localFile}`;
  const id = `canva-${slugFromFilename(localFile)}`;
  const title = slugFromFilename(localFile).replace(/-/g, ' ');
  const body = readFileSync(filePath);

  console.log(`\nUploading ${localFile} → r2://${bucket}/${key}`);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000',
    }),
  );

  const playbackUrl = `${publicBase}/${key.split('/').map(encodeURIComponent).join('/')}`;
  return {
    id,
    title,
    objectKey: key,
    localFile,
    streamUid: null,
    playbackUrl,
    thumbnailUrl: null,
  };
}

async function main() {
  const bucket = process.env.R2_BUCKET_PUBLIC?.trim() ?? 'reels';
  const { accountId, accessKeyId, secretAccessKey } = resolveR2Credentials();
  const publicBasePreset = process.env.R2_PUBLIC_BASE_URL?.trim();

  const client = new S3Client({
    region: 'auto',
    endpoint: r2Endpoint(accountId),
    credentials: { accessKeyId, secretAccessKey },
  });

  if (publicBasePreset) {
    console.log(`Using bucket "${bucket}" with public base ${publicBasePreset}`);
  } else {
    await ensureBucket(bucket);
  }

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Access Denied') || msg.includes('Forbidden')) {
      throw new Error(
        'R2 S3 access denied. Create an R2 API token (R2 → Manage API Tokens) for the "reels" bucket and set R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY in apps/api/.env',
      );
    }
    if (msg.includes('enable R2') || msg.includes('403') || msg.includes('404')) {
      throw new Error(
        'R2 bucket not reachable. Check R2_ACCOUNT_ID, R2_BUCKET_PUBLIC, and S3 credentials in apps/api/.env',
      );
    }
    throw err;
  }

  const publicBase = publicBasePreset
    ? publicBasePreset.replace(/\/$/, '')
    : await ensurePublicR2Dev(bucket);

  const args = process.argv.slice(2);
  const paths =
    args.length > 0 ? collectMp4Paths(args) : collectMp4Paths([DEFAULT_EXPORTS_DIR]);

  if (!paths.length) {
    throw new Error(
      `No MP4 files found. Export videos from Canva into ${DEFAULT_EXPORTS_DIR}`,
    );
  }

  const manifest = loadManifest();
  for (const filePath of paths) {
    const entry = await uploadFile(client, bucket, publicBase, filePath);
    upsertVideo(manifest, entry);
    console.log(`  URL: ${entry.playbackUrl}`);
  }

  saveManifest(manifest);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: 'reels-manifest.json',
      Body: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`),
      ContentType: 'application/json',
      CacheControl: 'public, max-age=60',
    }),
  );
  console.log(`Published reels-manifest.json → ${publicBase}/reels-manifest.json`);

  console.log(`\n✓ Uploaded ${paths.length} video(s) to R2. Restart Metro to refresh the app.`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
