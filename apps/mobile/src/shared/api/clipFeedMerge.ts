import type { ReelItem } from '@/shared/types';

function isRemoteMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function normalizedPlaybackUrl(value: ReelItem['videoUrl']): string | null {
  if (typeof value !== 'string' || !isRemoteMediaUrl(value)) return null;
  try {
    const url = new URL(value);
    // Signed delivery URLs for the same video can have different query
    // strings. Their resource path is the useful duplicate signal.
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return value;
  }
}

/**
 * Profile-published Clips take precedence, then editorial Reels fill any
 * remaining slots. Deduping both media URLs and duplicate clusters means the
 * legacy feed cannot reintroduce a video the personalized feed has excluded.
 */
export function mergePublishedClipFeeds(
  contentClips: ReelItem[],
  legacyReels: ReelItem[],
): ReelItem[] {
  const seenIds = new Set<string>();
  const seenMedia = new Set<string>();
  const seenClusters = new Set<string>();
  const merged: ReelItem[] = [];

  for (const item of [...contentClips, ...legacyReels]) {
    const mediaKey = normalizedPlaybackUrl(item.videoUrl);
    const clusterId = item.contentMetadata?.duplicateClusterId;
    if (
      seenIds.has(item.id) ||
      (mediaKey !== null && seenMedia.has(mediaKey)) ||
      (clusterId !== undefined && seenClusters.has(clusterId))
    ) {
      continue;
    }
    seenIds.add(item.id);
    if (mediaKey !== null) seenMedia.add(mediaKey);
    if (clusterId !== undefined) seenClusters.add(clusterId);
    merged.push(item);
  }

  return merged;
}
