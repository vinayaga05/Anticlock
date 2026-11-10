/**
 * VideoProvider — declared for future Cloudflare Stream integration.
 * Not implemented in Media Phases 1–2.
 */
export interface VideoProvider {
  createUploadSession(input: {
    maxDurationSeconds?: number;
    meta?: Record<string, string>;
    /** Prevent playback by UID alone for non-public content. */
    requireSignedUrls?: boolean;
  }): Promise<{
    uploadUrl: string;
    externalId: string;
    /** Cloudflare basic direct uploads accept multipart POST, not R2 PUT. */
    method: 'POST';
    fieldName: 'file';
  }>;

  getStatus(externalId: string): Promise<{
    status: 'processing' | 'ready' | 'error';
    durationMs?: number;
  }>;

  getPlayback(externalId: string, signed?: boolean): Promise<{
    playbackUrl: string;
    thumbnailUrl?: string;
    expiresAt?: string;
  }>;

  getThumbnail(externalId: string): Promise<string | null>;

  delete(externalId: string): Promise<void>;
}
