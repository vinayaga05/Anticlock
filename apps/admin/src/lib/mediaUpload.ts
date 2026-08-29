import type {
  CompleteUploadResponse,
  CreateUploadSessionResponse,
  MediaAccessLevel,
  MediaKind,
} from '@anticlock/contracts';
import { MAX_REEL_VIDEO_DURATION_MS } from '@anticlock/contracts';
import { apiFetch, apiPutBinary } from '@/lib/api';

export type VideoMetadata = {
  durationMs: number;
  width: number;
  height: number;
};

function normalizedMime(file: File) {
  return file.type.trim().toLowerCase().split(';', 1)[0] ?? '';
}

/** Reads browser metadata before requesting a short-lived upload URL. */
export async function readVideoMetadata(file: File): Promise<VideoMetadata> {
  if (normalizedMime(file) !== 'video/mp4') {
    throw new Error('Reel uploads must be MP4 videos (video/mp4).');
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute('src');
      video.load();
    };
    video.onloadedmetadata = () => {
      const durationMs = Math.round(video.duration * 1000);
      const width = video.videoWidth;
      const height = video.videoHeight;
      cleanup();

      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        reject(new Error('The video duration could not be read.'));
        return;
      }
      if (durationMs > MAX_REEL_VIDEO_DURATION_MS) {
        reject(new Error('Reel videos must be 3 minutes or shorter.'));
        return;
      }
      resolve({ durationMs, width, height });
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('The selected file is not a readable MP4 video.'));
    };
    video.src = objectUrl;
  });
}

export async function uploadMediaFile(input: {
  file: File;
  kind: MediaKind;
  accessLevel: MediaAccessLevel;
  entityHint?: string;
  onProgress?: (pct: number) => void;
}): Promise<CompleteUploadResponse> {
  input.onProgress?.(1);
  const videoMetadata =
    input.kind === 'video' ? await readVideoMetadata(input.file) : undefined;

  const session = await apiFetch<CreateUploadSessionResponse>(
    '/admin/media/upload-url',
    {
      method: 'POST',
      body: JSON.stringify({
        kind: input.kind,
        accessLevel: input.accessLevel,
        filename: input.file.name,
        contentType: input.file.type || 'application/octet-stream',
        byteSize: input.file.size,
        durationMs: videoMetadata?.durationMs,
        width: videoMetadata?.width,
        height: videoMetadata?.height,
        entityHint: input.entityHint,
      }),
    },
  );
  input.onProgress?.(8);
  await apiPutBinary(session.uploadUrl, input.file, session.headers, progress =>
    input.onProgress?.(8 + Math.round(progress * 0.84)),
  );
  input.onProgress?.(94);
  const result = await apiFetch<CompleteUploadResponse>(
    `/admin/media/${session.mediaId}/complete`,
    { method: 'POST', body: JSON.stringify({}) },
  );
  input.onProgress?.(100);
  return result;
}

export function formatBytes(n: number | null | undefined) {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(durationMs: number | null | undefined) {
  if (!durationMs) return '—';
  const wholeSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
