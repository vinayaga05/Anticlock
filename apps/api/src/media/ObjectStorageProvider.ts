import type { MediaAccessLevel, MediaTransform } from '@anticlock/contracts';

export type StorageBucket = 'public-media' | 'private-documents';

export type UploadTarget = {
  uploadUrl: string;
  headers: Record<string, string>;
  method: 'PUT';
};

export type ObjectMetadata = {
  byteSize: number;
  contentType?: string;
  etag?: string;
};

export interface ObjectStorageProvider {
  readonly name: 'r2' | 'local';

  createUploadTarget(input: {
    bucket: StorageBucket;
    key: string;
    contentType: string;
    maxBytes: number;
    /** Used by local provider to mint an API-relative upload URL. */
    sessionId?: string;
  }): Promise<UploadTarget>;

  putObject(input: {
    bucket: StorageBucket;
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void>;

  getObjectBuffer(input: {
    bucket: StorageBucket;
    key: string;
  }): Promise<Buffer>;

  /**
   * Read a small leading range for container-signature validation.  This keeps
   * direct R2 video confirmation from proxying an entire upload through API.
   */
  getObjectPrefix(input: {
    bucket: StorageBucket;
    key: string;
    byteLength: number;
  }): Promise<Buffer>;

  /**
   * Promotes an upload-only object to its immutable delivery key. The signed
   * PUT targets the source key, so it cannot overwrite a completed asset.
   */
  finalizeUpload(input: {
    bucket: StorageBucket;
    sourceKey: string;
    destinationKey: string;
    sourceEtag?: string;
  }): Promise<void>;

  verifyObject(input: {
    bucket: StorageBucket;
    key: string;
  }): Promise<ObjectMetadata | null>;

  deleteObject(input: { bucket: StorageBucket; key: string }): Promise<void>;

  createDownloadUrl(input: {
    bucket: StorageBucket;
    key: string;
    accessLevel: MediaAccessLevel;
    expiresInSeconds?: number;
    transform?: MediaTransform;
  }): Promise<string | null>;
}

export function bucketForAccess(level: MediaAccessLevel): StorageBucket {
  return level === 'private' ? 'private-documents' : 'public-media';
}

export function extensionForMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'application/pdf': 'pdf',
    'video/mp4': 'mp4',
  };
  const normalized = mime.trim().toLowerCase().split(';', 1)[0] ?? '';
  return map[normalized] ?? 'bin';
}
