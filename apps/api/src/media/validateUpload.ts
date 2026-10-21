import { createHash } from 'node:crypto';
import { imageSize } from 'image-size';
import {
  MAX_REEL_VIDEO_DURATION_MS,
  type MediaKind,
} from '@anticlock/contracts';

/** KYC / add-business documents accept any non-empty MIME (PDF, photos, office, etc.). */
const VIDEO_MIMES = new Set(['video/mp4']);

function normalizeMime(mime: string) {
  return mime.trim().toLowerCase().split(';', 1)[0] ?? '';
}

function isImageMime(mime: string) {
  return normalizeMime(mime).startsWith('image/');
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
  if (
    buf.length >= 2 &&
    buf[0] === 0x42 &&
    buf[1] === 0x4d
  ) {
    return 'image/bmp';
  }
  if (
    buf.length >= 4 &&
    ((buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) ||
      (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a))
  ) {
    return 'image/tiff';
  }
  // HEIC/HEIF / AVIF often use ISO BMFF with an ftyp brand.
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (
      brand === 'heic' ||
      brand === 'heix' ||
      brand === 'mif1' ||
      brand === 'msf1' ||
      brand === 'heif'
    ) {
      return 'image/heic';
    }
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    return 'video/mp4';
  }
  if (buf.length >= 5 && buf.toString('ascii', 0, 5) === '%PDF-') {
    return 'application/pdf';
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
  if (!normalized || normalized.length > 200) {
    throw Object.assign(new Error(`MIME type ${mime} not allowed for ${kind}`), {
      code: 'invalid_mime',
      status: 400,
    });
  }
  // Provider KYC documents may be any file the applicant has (PDF, photo, office…).
  if (kind === 'document') return;
  // Logo / cover / profile photos: any image/* (JPEG, PNG, WebP, HEIC, GIF, …).
  if (kind === 'image') {
    if (isImageMime(normalized)) return;
    throw Object.assign(
      new Error(`MIME type ${mime} not allowed for ${kind}`),
      { code: 'invalid_mime', status: 400 },
    );
  }
  if (!VIDEO_MIMES.has(normalized)) {
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

  const expectedRaw = normalizeMime(input.expectedMime);
  const expected = expectedRaw === 'image/jpg' ? 'image/jpeg' : expectedRaw;
  const detectedRaw = detectMimeFromMagic(input.body);
  const detected =
    detectedRaw === 'image/jpg' ? 'image/jpeg' : detectedRaw;

  // Documents: accept any declared type. Use magic when we recognize it;
  // otherwise keep the client Content-Type (office docs, scans, etc.).
  if (input.kind === 'document') {
    const mimeType = detected ?? expected;
    assertAllowedMime('document', mimeType);
    return {
      mimeType,
      byteSize: input.body.length,
      checksumSha256: sha256(input.body),
      width: null,
      height: null,
    };
  }

  // Profile images (logo/cover): accept declared image/* when magic is unknown
  // (HEIC and some phone formats), and do not hard-fail on dimension probing.
  if (input.kind === 'image') {
    const mimeType = detected && isImageMime(detected) ? detected : expected;
    assertAllowedMime('image', mimeType);
    if (detected && isImageMime(detected) && expected && !isImageMime(expected)) {
      throw Object.assign(
        new Error(`Content-Type mismatch: expected ${expected}, got ${detected}`),
        { code: 'mime_mismatch', status: 400 },
      );
    }
    let width: number | null = null;
    let height: number | null = null;
    try {
      const dim = imageSize(input.body);
      width = dim.width ?? null;
      height = dim.height ?? null;
    } catch {
      /* HEIC / uncommon codecs — still store the bytes. */
    }
    return {
      mimeType,
      byteSize: input.body.length,
      checksumSha256: sha256(input.body),
      width,
      height,
    };
  }

  if (!detected) {
    throw Object.assign(new Error('Unrecognized file signature'), {
      code: 'invalid_signature',
      status: 400,
    });
  }
  assertAllowedMime(input.kind, detected);

  if (expected !== detected) {
    throw Object.assign(
      new Error(`Content-Type mismatch: expected ${expected}, got ${detected}`),
      { code: 'mime_mismatch', status: 400 },
    );
  }

  return {
    mimeType: detected,
    byteSize: input.body.length,
    checksumSha256: sha256(input.body),
    width: null,
    height: null,
  };
}
