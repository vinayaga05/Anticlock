import type { VideoProvider } from './VideoProvider.js';

type StreamApiResult<T> = {
  success: boolean;
  errors?: { message: string }[];
  result?: T;
};

function requireStreamEnv() {
  const accountId = process.env.STREAM_ACCOUNT_ID?.trim();
  const apiToken = process.env.STREAM_API_TOKEN?.trim();
  if (!accountId || !apiToken) {
    throw new Error(
      'Cloudflare Stream is not configured (STREAM_ACCOUNT_ID / STREAM_API_TOKEN)',
    );
  }
  return { accountId, apiToken };
}

export function isStreamConfigured() {
  return Boolean(
    process.env.STREAM_ACCOUNT_ID?.trim() &&
      process.env.STREAM_API_TOKEN?.trim(),
  );
}

export function streamPlaybackUrl(uid: string) {
  const subdomain = process.env.STREAM_CUSTOMER_SUBDOMAIN?.trim();
  if (subdomain) {
    return `https://${subdomain}/${uid}/manifest/video.m3u8`;
  }
  return `https://customer-${process.env.STREAM_ACCOUNT_ID}.cloudflarestream.com/${uid}/manifest/video.m3u8`;
}

function streamDeliveryBase() {
  const subdomain = process.env.STREAM_CUSTOMER_SUBDOMAIN?.trim();
  if (subdomain) return `https://${subdomain}`;
  return `https://customer-${process.env.STREAM_ACCOUNT_ID}.cloudflarestream.com`;
}

export function streamThumbnailUrl(uid: string) {
  const subdomain = process.env.STREAM_CUSTOMER_SUBDOMAIN?.trim();
  if (subdomain) {
    return `https://${subdomain}/${uid}/thumbnails/thumbnail.jpg`;
  }
  return `https://customer-${process.env.STREAM_ACCOUNT_ID}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`;
}

async function streamFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
  if (!res.ok || !json.success || !json.result) {
    const msg =
      json.errors?.map(e => e.message).join('; ') ||
      `Stream API error (${res.status})`;
    throw new Error(msg);
  }
  return json.result;
}

/**
 * Cloudflare Stream implementation of VideoProvider.
 * Direct creator uploads + public or short-lived signed HLS playback.
 */
export class CloudflareStreamVideoProvider implements VideoProvider {
  private readonly signedPlaybackCache = new Map<
    string,
    { playbackUrl: string; thumbnailUrl: string; expiresAt: string }
  >();

  async createUploadSession(input: {
    maxDurationSeconds?: number;
    meta?: Record<string, string>;
    requireSignedUrls?: boolean;
  }): Promise<{
    uploadUrl: string;
    externalId: string;
    method: 'POST';
    fieldName: 'file';
  }> {
    const maxDurationSeconds =
      input.maxDurationSeconds ??
      Number(process.env.STREAM_MAX_DURATION_SECONDS ?? 180);

    const result = await streamFetch<{ uploadURL: string; uid: string }>(
      '/direct_upload',
      {
        method: 'POST',
        body: JSON.stringify({
          maxDurationSeconds,
          requireSignedURLs: input.requireSignedUrls === true,
          meta: input.meta ?? {},
        }),
      },
    );

    return {
      uploadUrl: result.uploadURL,
      externalId: result.uid,
      method: 'POST',
      fieldName: 'file',
    };
  }

  async getStatus(externalId: string): Promise<{
    status: 'processing' | 'ready' | 'error';
    durationMs?: number;
  }> {
    const result = await streamFetch<{
      readyToStream?: boolean;
      status?: { state?: string; errorReasonText?: string };
      duration?: number;
    }>(`/${encodeURIComponent(externalId)}`);

    const state = result.status?.state?.toLowerCase();
    if (result.readyToStream || state === 'ready') {
      return {
        status: 'ready',
        durationMs:
          typeof result.duration === 'number'
            ? Math.round(result.duration * 1000)
            : undefined,
      };
    }
    if (state === 'error') {
      return { status: 'error' };
    }
    return { status: 'processing' };
  }

  async getPlayback(
    externalId: string,
    signed = false,
  ): Promise<{
    playbackUrl: string;
    thumbnailUrl?: string;
    expiresAt?: string;
  }> {
    if (signed) {
      const cached = this.signedPlaybackCache.get(externalId);
      if (
        cached &&
        new Date(cached.expiresAt).getTime() - Date.now() > 60 * 1000
      ) {
        return cached;
      }
      const ttlSeconds = Math.min(
        24 * 60 * 60,
        Math.max(
          5 * 60,
          Number(process.env.STREAM_PLAYBACK_TOKEN_TTL_SECONDS ?? 60 * 60),
        ),
      );
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      const result = await streamFetch<{ token: string }>(
        `/${encodeURIComponent(externalId)}/token`,
        {
          method: 'POST',
          body: JSON.stringify({
            exp: Math.floor(expiresAt.getTime() / 1000),
          }),
        },
      );
      const playback = {
        playbackUrl: `${streamDeliveryBase()}/${result.token}/manifest/video.m3u8`,
        thumbnailUrl: streamThumbnailUrl(externalId),
        expiresAt: expiresAt.toISOString(),
      };
      if (this.signedPlaybackCache.size >= 1_000) {
        const oldest = this.signedPlaybackCache.keys().next().value;
        if (oldest) this.signedPlaybackCache.delete(oldest);
      }
      this.signedPlaybackCache.set(externalId, playback);
      return playback;
    }
    return {
      playbackUrl: streamPlaybackUrl(externalId),
      thumbnailUrl: streamThumbnailUrl(externalId),
    };
  }

  async getThumbnail(externalId: string): Promise<string | null> {
    return streamThumbnailUrl(externalId);
  }

  async delete(externalId: string): Promise<void> {
    const { accountId, apiToken } = requireStreamEnv();
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${encodeURIComponent(
        externalId,
      )}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiToken}` },
      },
    );
    if (!res.ok && res.status !== 404) {
      const json = (await res
        .json()
        .catch(() => null)) as StreamApiResult<unknown> | null;
      const msg =
        json?.errors?.map(e => e.message).join('; ') ||
        `Stream delete failed (${res.status})`;
      throw new Error(msg);
    }
  }
}

let cached: CloudflareStreamVideoProvider | null = null;

export function getVideoProvider(): CloudflareStreamVideoProvider | null {
  if (!isStreamConfigured()) return null;
  if (!cached) cached = new CloudflareStreamVideoProvider();
  return cached;
}

export function requireVideoProvider(): CloudflareStreamVideoProvider {
  const provider = getVideoProvider();
  if (!provider) {
    throw new Error(
      'Cloudflare Stream is not configured (STREAM_ACCOUNT_ID / STREAM_API_TOKEN)',
    );
  }
  return provider;
}
