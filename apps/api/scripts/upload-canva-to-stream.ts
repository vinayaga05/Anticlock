/**
 * Upload Canva-export MP4s from assets/canva-exports/ to Cloudflare Stream.
 * Writes playback URLs to apps/mobile/src/shared/data/cloudflare-videos.manifest.json
 *
 * Usage:
 *   pnpm --filter @anticlock/api stream:upload-canva
 *   pnpm --filter @anticlock/api stream:upload-canva -- path/to/video.mp4
 *   pnpm --filter @anticlock/api stream:upload-canva -- --copy-url https://... --title "Clip"
 */
import 'dotenv/config';
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
  isStreamConfigured,
  streamPlaybackUrl,
  streamThumbnailUrl,
} from '../src/media/CloudflareStreamVideoProvider.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const DEFAULT_EXPORTS_DIR = join(REPO_ROOT, 'assets/canva-exports');
const MANIFEST_PATH = join(
  REPO_ROOT,
  'apps/mobile/src/shared/data/cloudflare-videos.manifest.json',
);

type ManifestVideo = {
  id: string;
  title: string;
  localFile: string;
  streamUid: string | null;
  playbackUrl: string | null;
  thumbnailUrl: string | null;
};

type Manifest = {
  version: number;
  updatedAt: string;
  source: string;
  videos: ManifestVideo[];
};

type StreamApiResult<T> = {
  success: boolean;
  errors?: { message: string }[];
  result?: T;
};

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function requireStreamEnv() {
  const accountId = process.env.STREAM_ACCOUNT_ID?.trim();
  const apiToken = process.env.STREAM_API_TOKEN?.trim();
  if (!accountId || !apiToken) {
    throw new Error(
      'Set STREAM_ACCOUNT_ID and STREAM_API_TOKEN in apps/api/.env (see assets/canva-exports/README.md)',
    );
  }
  return { accountId, apiToken };
}

async function streamApi<T>(path: string, init?: RequestInit): Promise<T> {
  const { accountId, apiToken } = requireStreamEnv();
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    },
  );
  const json = (await res.json()) as StreamApiResult<T>;
  if (!res.ok || !json.success || json.result === undefined) {
    const msg =
      json.errors?.map(e => e.message).join('; ') ||
      `Stream API error (${res.status})`;
    throw new Error(msg);
  }
  return json.result;
}

function slugFromFilename(file: string) {
  return basename(file, '.mp4')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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
  (manifest as { remoteEnabled?: boolean }).remoteEnabled = true;
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nWrote manifest → ${MANIFEST_PATH}`);
}

function upsertVideo(manifest: Manifest, entry: ManifestVideo) {
  const idx = manifest.videos.findIndex(v => v.id === entry.id);
  if (idx >= 0) manifest.videos[idx] = entry;
  else manifest.videos.push(entry);
}

async function waitUntilReady(uid: string) {
  for (let attempt = 0; attempt < 90; attempt++) {
    const result = await streamApi<{
      readyToStream?: boolean;
      status?: { state?: string; errorReasonText?: string };
    }>(`/${encodeURIComponent(uid)}`);

    const state = result.status?.state?.toLowerCase();
    if (result.readyToStream || state === 'ready') return;
    if (state === 'error') {
      throw new Error(
        result.status?.errorReasonText ?? 'Stream processing failed',
      );
    }
    process.stdout.write('.');
    await sleep(2000);
  }
  throw new Error(`Timed out waiting for Stream video ${uid}`);
}

async function uploadFile(filePath: string, title?: string): Promise<ManifestVideo> {
  const localFile = basename(filePath);
  const id = `canva-${slugFromFilename(localFile)}`;
  const displayTitle = title ?? slugFromFilename(localFile).replace(/-/g, ' ');

  console.log(`\nUploading ${localFile}…`);

  const { uploadURL, uid } = await streamApi<{ uploadURL: string; uid: string }>(
    '/direct_upload',
    {
      method: 'POST',
      body: JSON.stringify({
        maxDurationSeconds: Number(process.env.STREAM_MAX_DURATION_SECONDS ?? 120),
        requireSignedURLs: false,
        meta: { source: 'canva-export', title: displayTitle },
      }),
    },
  );

  const body = readFileSync(filePath);
  const putRes = await fetch(uploadURL, {
    method: 'POST',
    headers: { 'Content-Type': 'video/mp4' },
    body,
  });
  if (!putRes.ok) {
    throw new Error(`Direct upload failed (${putRes.status}) for ${localFile}`);
  }

  process.stdout.write(' processing');
  await waitUntilReady(uid);
  console.log(' ready');

  return {
    id,
    title: displayTitle,
    localFile,
    streamUid: uid,
    playbackUrl: streamPlaybackUrl(uid),
    thumbnailUrl: streamThumbnailUrl(uid),
  };
}

async function copyFromUrl(url: string, title: string): Promise<ManifestVideo> {
  console.log(`\nCopying from URL → Stream…`);
  const result = await streamApi<{ uid: string }>('/copy', {
    method: 'POST',
    body: JSON.stringify({
      url,
      meta: { source: 'canva-export', title },
    }),
  });

  process.stdout.write(' processing');
  await waitUntilReady(result.uid);
  console.log(' ready');

  const localFile = `${slugFromFilename(title)}.mp4`;
  return {
    id: `canva-${slugFromFilename(title)}`,
    title,
    localFile,
    streamUid: result.uid,
    playbackUrl: streamPlaybackUrl(result.uid),
    thumbnailUrl: streamThumbnailUrl(result.uid),
  };
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

async function main() {
  if (!isStreamConfigured()) {
    console.error(
      'Cloudflare Stream is not configured. Add STREAM_ACCOUNT_ID and STREAM_API_TOKEN to apps/api/.env',
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const manifest = loadManifest();

  const copyUrlIdx = args.indexOf('--copy-url');
  if (copyUrlIdx >= 0) {
    const url = args[copyUrlIdx + 1];
    const titleIdx = args.indexOf('--title');
    const title = titleIdx >= 0 ? args[titleIdx + 1] : 'Canva clip';
    if (!url) throw new Error('--copy-url requires a URL argument');
    const entry = await copyFromUrl(url, title ?? 'Canva clip');
    upsertVideo(manifest, entry);
    saveManifest(manifest);
    console.log(`\n✓ ${entry.title}`);
    console.log(`  HLS: ${entry.playbackUrl}`);
    return;
  }

  const paths =
    args.length > 0 ? collectMp4Paths(args) : collectMp4Paths([DEFAULT_EXPORTS_DIR]);

  if (!paths.length) {
    console.error(
      `No MP4 files found. Export videos from Canva into ${DEFAULT_EXPORTS_DIR}`,
    );
    process.exit(1);
  }

  for (const filePath of paths) {
    const entry = await uploadFile(filePath);
    upsertVideo(manifest, entry);
    console.log(`  HLS: ${entry.playbackUrl}`);
  }

  saveManifest(manifest);
  console.log(`\n✓ Uploaded ${paths.length} video(s). Restart Metro to refresh the app.`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
