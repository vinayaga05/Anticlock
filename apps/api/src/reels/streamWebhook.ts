import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { mediaAssets } from '../db/schema.js';
import {
  getVideoProvider,
  streamThumbnailUrl,
} from '../media/CloudflareStreamVideoProvider.js';

/**
 * Verify Cloudflare Stream webhook signature.
 * Header: Webhook-Signature: time=<unix>,sig1=<hex>
 */
export function verifyStreamWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => {
      const [k, ...rest] = p.split('=');
      return [k.trim(), rest.join('=')];
    }),
  );
  const time = parts.time;
  const sig1 = parts.sig1;
  if (!time || !sig1) return false;

  const source = `${time}.${rawBody}`;
  const expected = createHmac('sha256', secret).update(source).digest('hex');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(sig1, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

type StreamWebhookPayload = {
  uid?: string;
  readyToStream?: boolean;
  status?: { state?: string };
  duration?: number;
  meta?: Record<string, string>;
};

export async function applyStreamWebhook(payload: StreamWebhookPayload) {
  const uid = payload.uid;
  if (!uid) return { updated: false, reason: 'missing_uid' as const };

  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.externalId, uid),
        eq(mediaAssets.storageProvider, 'stream'),
        isNull(mediaAssets.deletedAt),
      ),
    )
    .limit(1);

  if (!asset) {
    return { updated: false, reason: 'unknown_uid' as const };
  }

  const state = payload.status?.state?.toLowerCase();
  const ready = payload.readyToStream || state === 'ready';
  const failed = state === 'error';

  if (ready) {
    const durationMs =
      typeof payload.duration === 'number'
        ? Math.round(payload.duration * 1000)
        : asset.durationMs;
    const thumbnailUrl =
      asset.thumbnailUrl ?? streamThumbnailUrl(uid);

    // Prefer live Stream status when available
    const provider = getVideoProvider();
    let resolvedDuration = durationMs ?? undefined;
    let resolvedThumb = thumbnailUrl;
    if (provider) {
      try {
        const st = await provider.getStatus(uid);
        if (st.durationMs) resolvedDuration = st.durationMs;
        const pb = await provider.getPlayback(uid);
        if (pb.thumbnailUrl) resolvedThumb = pb.thumbnailUrl;
      } catch {
        /* keep webhook values */
      }
    }

    await db
      .update(mediaAssets)
      .set({
        processingStatus: 'ready',
        durationMs: resolvedDuration ?? null,
        thumbnailUrl: resolvedThumb,
      })
      .where(eq(mediaAssets.id, asset.id));

    return { updated: true, mediaId: asset.id, status: 'ready' as const };
  }

  if (failed) {
    await db
      .update(mediaAssets)
      .set({ processingStatus: 'failed' })
      .where(eq(mediaAssets.id, asset.id));
    return { updated: true, mediaId: asset.id, status: 'failed' as const };
  }

  await db
    .update(mediaAssets)
    .set({ processingStatus: 'processing' })
    .where(eq(mediaAssets.id, asset.id));

  return { updated: true, mediaId: asset.id, status: 'processing' as const };
}
