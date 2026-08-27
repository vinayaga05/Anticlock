/**
 * VideoProvider — declared for future Cloudflare Stream integration.
 * Not implemented in Media Phases 1–2.
 */
export interface VideoProvider {
  createUploadSession(input: {
    maxDurationSeconds?: number;
    meta?: Record<string, string>;
  }): Promise<{ uploadUrl: string; externalId: string }>;

  getStatus(externalId: string): Promise<{
    status: 'processing' | 'ready' | 'error';
    durationMs?: number;
  }>;

  getPlayback(externalId: string, signed?: boolean): Promise<{
    playbackUrl: string;
    thumbnailUrl?: string;
  }>;

  getThumbnail(externalId: string): Promise<string | null>;

  delete(externalId: string): Promise<void>;
}
