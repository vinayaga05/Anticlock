import { createHash } from 'node:crypto';
import { imageSize } from 'image-size';
import {
  MAX_REEL_VIDEO_DURATION_MS,
  type MediaKind,
} from '@anticlock/contracts';

const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const DOC_MIMES = new Set(['application/pdf']);
const VIDEO_MIMES = new Set(['video/mp4']);

function normalizeMime(mime: string) {
  return mime.trim().toLowerCase().split(';', 1)[0] ?? '';
}

export function detectMimeFromMagic(buf: Buffer): string | null {
  if (
    buf.length >= 3 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buf.length >= 6 && buf.toString('ascii', 0, 6) === 'GIF87a')
    return 'image/gif';
  if (buf.length >= 6 && buf.toString('ascii', 0, 6) === 'GIF89a')
    return 'image/gif';
  if (buf.length >= 5 && buf.toString('ascii', 0, 5) === '%PDF-') {
    return 'application/pdf';
  }
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    return 'video/mp4';
  }
  return null;
}

export function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function maxBytesForKind(kind: MediaKind): number {
  if (kind === 'image') {
    return Number(process.env.MEDIA_UPLOAD_MAX_IMAGE_BYTES ?? 10 * 1024 * 1024);
  }
  if (kind === 'video') {
    return Number(
      process.env.MEDIA_UPLOAD_MAX_VIDEO_BYTES ?? 250 * 1024 * 1024,
    );
  }
  return Number(process.env.MEDIA_UPLOAD_MAX_DOC_BYTES ?? 20 * 1024 * 1024);
}

export function assertAllowedMime(kind: MediaKind, mime: string) {
  const normalized = normalizeMime(mime);
  const ok =
    kind === 'image'
      ? IMAGE_MIMES.has(normalized)
      : kind === 'video'
      ? VIDEO_MIMES.has(normalized)
      : DOC_MIMES.has(normalized);
  if (!ok) {
    throw Object.assign(
      new Error(`MIME type ${mime} not allowed for ${kind}`),
      {
        code: 'invalid_mime',
        status: 400,
      },
    );
  }
}

export type ValidatedUpload = {
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
  width: number | null;
  height: number | null;
};

/**
 * R2 gives us object headers without downloading a potentially large video
 * through the API. The browser supplies duration metadata before it receives
 * the signed URL; we enforce the same cap again on completion.
 */
export function validateVideoUploadMetadata(input: {
  expectedMime: string;
  maxBytes: number;
  byteSize: number;
  contentType?: string;
  durationMs: number | null;
}) {
  if (!input.durationMs || input.durationMs > MAX_REEL_VIDEO_DURATION_MS) {
    throw Object.assign(new Error('Reel videos must be 3 minutes or shorter'), {
      code: 'video_too_long',
      status: 400,
    });
  }
  if (input.byteSize <= 0 || input.byteSize > input.maxBytes) {
    throw Object.assign(new Error('File exceeds max size'), {
      code: 'file_too_large',
      status: 400,
    });
  }

  const expected = normalizeMime(input.expectedMime);
  const actual = normalizeMime(input.contentType ?? input.expectedMime);
  assertAllowedMime('video', actual);
  if (actual !== expected) {
    throw Object.assign(
      new Error(`Content-Type mismatch: expected ${expected}, got ${actual}`),
      { code: 'mime_mismatch', status: 400 },
    );
  }

  return {
    mimeType: actual,
    byteSize: input.byteSize,
    durationMs: input.durationMs,
  };
}

export function validateUploadedBytes(input: {
  kind: MediaKind;
  expectedMime: string;
  maxBytes: number;
  body: Buffer;
}): ValidatedUpload {
  if (input.body.length === 0) {
    throw Object.assign(new Error('Empty upload'), {
      code: 'empty_upload',
      status: 400,
    });
  }
  if (input.body.length > input.maxBytes) {
    throw Object.assign(new Error('File exceeds max size'), {
      code: 'file_too_large',
      status: 400,
    });
  }

  const detected = detectMimeFromMagic(input.body);
  if (!detected) {
    throw Object.assign(new Error('Unrecognized file signature'), {
      code: 'invalid_signature',
      status: 400,
    });
  }
  assertAllowedMime(input.kind, detected);

  // Normalize jpeg aliases
  const expected =
    normalizeMime(input.expectedMime) === 'image/jpg'
      ? 'image/jpeg'
      : normalizeMime(input.expectedMime);
  const actual = detected === 'image/jpg' ? 'image/jpeg' : detected;
  if (
    expected !== actual &&
    !(expected === 'image/jpeg' && actual === 'image/jpeg')
  ) {
    if (expected !== actual) {
      throw Object.assign(
        new Error(`Content-Type mismatch: expected ${expected}, got ${actual}`),
        { code: 'mime_mismatch', status: 400 },
      );
    }
  }

  let width: number | null = null;
  let height: number | null = null;
  if (input.kind === 'image') {
    try {
      const dim = imageSize(input.body);
      width = dim.width ?? null;
      height = dim.height ?? null;
    } catch {
      throw Object.assign(new Error('Unable to read image dimensions'), {
        code: 'invalid_image',
        status: 400,
      });
    }
  }

  return {
    mimeType: actual,
    byteSize: input.body.length,
    checksumSha256: sha256(input.body),
    width,
    height,
  };
}
