import type { ReelItem } from '@/shared/types';

type EditorialReel = {
  id?: unknown;
  status?: unknown;
  title?: unknown;
  caption?: unknown;
  creatorName?: unknown;
  playbackUrl?: unknown;
  posterUrl?: unknown;
  likeCount?: unknown;
  commentCount?: unknown;
  cta?: {
    entityType?: unknown;
    entityId?: unknown;
  } | null;
};

function remoteMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function count(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function editorialItem(item: EditorialReel): ReelItem | null {
  if (item.status !== 'published' || !remoteMediaUrl(item.playbackUrl)) return null;
  if (typeof item.id !== 'string' || !item.id) return null;
  const cta = item.cta;
  const entityType = cta?.entityType;
  const entityId = typeof cta?.entityId === 'string' ? cta.entityId : '';
  const bookTarget =
    entityId &&
    (entityType === 'provider' ||
      entityType === 'event' ||
      entityType === 'course' ||
      entityType === 'product' ||
      entityType === 'service_category')
      ? {
          entityType:
            entityType === 'service_category'
              ? undefined
              : (entityType as 'provider' | 'event' | 'course' | 'product'),
          entityId,
          serviceCategoryId:
            entityType === 'service_category' ? entityId : undefined,
          cta:
            entityType === 'product'
              ? ('cart' as const)
              : entityType === 'event'
              ? ('trip' as const)
              : ('book' as const),
        }
      : undefined;
  return {
    id: item.id,
    title: typeof item.title === 'string' ? item.title : '',
    author: typeof item.creatorName === 'string' ? item.creatorName : '',
    caption: typeof item.caption === 'string' ? item.caption : '',
    videoUrl: item.playbackUrl,
    posterUrl: remoteMediaUrl(item.posterUrl) ? item.posterUrl : '',
    likeCount: count(item.likeCount),
    commentCount: count(item.commentCount),
    reportTarget: { kind: 'legacy_reel', id: item.id },
    feedSource: 'legacy_reel',
    bookTarget,
  };
}

/** Published editorial clips from GET /v1/reels, in catalog order. */
export function publishedEditorialReels(items: unknown): ReelItem[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const reel = editorialItem(item as EditorialReel);
    return reel ? [reel] : [];
  });
}

/** Profile clips stay first. Editorial clips fill the rest without repeating an id. */
export function mergeClipFeedItems(
  contentItems: readonly ReelItem[],
  editorialItems: readonly ReelItem[],
): ReelItem[] {
  const seen = new Set(contentItems.map(item => item.id));
  return [
    ...contentItems,
    ...editorialItems.filter(item => !seen.has(item.id)),
  ];
}
