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
 * Direct creator uploads + public HLS playback (no signed URLs in this slice).
 */
export class CloudflareStreamVideoProvider implements VideoProvider {
  async createUploadSession(input: {
    maxDurationSeconds?: number;
    meta?: Record<string, string>;
  }): Promise<{ uploadUrl: string; externalId: string }> {
    const maxDurationSeconds =
      input.maxDurationSeconds ??
      Number(process.env.STREAM_MAX_DURATION_SECONDS ?? 180);

    const result = await streamFetch<{ uploadURL: string; uid: string }>(
      '/direct_upload',
      {
        method: 'POST',
        body: JSON.stringify({
          maxDurationSeconds,
          requireSignedURLs: false,
          meta: input.meta ?? {},
        }),
      },
    );

    return { uploadUrl: result.uploadURL, externalId: result.uid };
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
    _signed?: boolean,
  ): Promise<{ playbackUrl: string; thumbnailUrl?: string }> {
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
