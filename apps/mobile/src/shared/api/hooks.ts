import { useQuery } from '@tanstack/react-query';
import { apiRequest, ApiError } from './client';
import { isApiEnabled } from './config';
import { readStoredSession } from '@/shared/services/auth/authService';
import type { ReelItem } from '@/shared/types';

export type ApiServiceTree = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  accentColor?: string;
  sortOrder: number;
  status: string;
};

export type ApiServiceCategory = {
  id: string;
  treeId: string;
  name: string;
  description?: string;
  icon?: string;
  actionType?: string;
  sortOrder: number;
  status: string;
};

export type ApiReelFeedItem = {
  id: string;
  /** The API emits this only after the server-side publication gate passes. */
  /** The authenticated feed contains only published posts; optional for compatibility. */
  status?: 'published';
  title: string;
  caption: string | null;
  creatorName: string;
  category: string | null;
  playbackUrl: string;
  posterUrl: string | null;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  cta: {
    entityType:
      | 'provider'
      | 'event'
      | 'course'
      | 'product'
      | 'service_category';
    entityId: string;
    ctaLabel?: string;
  } | null;
  /** Optional while the editorial Reel feed migrates to profile-backed clips. */
  author?: {
    type: 'user' | 'business';
    id: string;
    name: string;
    avatarUrl?: string | null;
  } | null;
};

/** Current shape of an item returned by GET /v1/content/feeds/clip. */
export type ApiContentClipFeedItem = {
  id: string;
  format: 'clip';
  mediaType: 'video';
  status: 'published';
  visibility: string;
  caption: string | null;
  hashtags: string[];
  taggedUserIds: string[];
  location: {
    name: string;
    latitude?: number;
    longitude?: number;
  } | null;
  duplicateClusterId: string;
  playbackUrl: string;
  posterUrl: string | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  /** The authenticated viewer's durable like state for this content Clip. */
  viewerHasLiked: boolean;
  shareCount: number;
  createdAt: string;
  publishedAt: string;
  /** Music the creator mixed in on-device (display/attribution only). */
  music?: {
    trackId: string;
    source: 'bundled' | 'remote';
    title: string;
    artist: string | null;
  } | null;
  author: {
    // The publishing API calls a business identity a provider; mobile calls
    // the same visible profile a business.
    type: 'user' | 'provider' | 'business';
    id: string;
    name: string;
    avatarUrl: string | null;
  };
};

export type ApiContentClipFeedResponse = {
  items: ApiContentClipFeedItem[];
  nextCursor: string | null;
};

export type ApiCmsBanner = {
  id: string;
  title: string;
  imageUrl: string | null;
};

/** Temporary local fallback shown until the CMS has a published banner. */
const MOCK_CMS_BANNERS: ApiCmsBanner[] = [
  {
    id: 'mock-health-ad',
    title: 'Complete health check-ups, made easy',
    imageUrl:
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&h=500&q=85',
  },
];

function ensureAuthToken() {
  const session = readStoredSession();
  if (!session?.token) {
    throw new ApiError(401, 'unauthorized', 'Not authenticated');
  }
}

export function mapApiReelToItem(r: ApiReelFeedItem): ReelItem {
  const bookTarget = r.cta
    ? {
        entityType:
          r.cta.entityType === 'service_category'
            ? undefined
            : (r.cta.entityType as 'provider' | 'event' | 'course' | 'product'),
        entityId: r.cta.entityId,
        serviceCategoryId:
          r.cta.entityType === 'service_category' ? r.cta.entityId : undefined,
        cta:
          r.cta.entityType === 'product'
            ? ('cart' as const)
            : r.cta.entityType === 'event'
            ? ('trip' as const)
            : ('book' as const),
      }
    : undefined;

  return {
    id: r.id,
    title: r.title,
    author: r.author?.name ?? r.creatorName,
    authorAvatarUrl: r.author?.avatarUrl ?? undefined,
    authorProfile: r.author
      ? { type: r.author.type, id: r.author.id }
      : undefined,
    reportTarget: { kind: 'legacy_reel', id: r.id },
    feedSource: 'legacy_reel',
    caption: r.caption ?? '',
    videoUrl: r.playbackUrl,
    posterUrl: r.posterUrl ?? '',
    likeCount: r.likeCount,
    commentCount: r.commentCount,
    bookTarget,
  };
}

function isRemoteMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nonNegativeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(isNonEmptyString) : [];
}

function contentLocation(
  value: unknown,
): NonNullable<ReelItem['contentMetadata']>['location'] {
  if (!value || typeof value !== 'object') return null;
  const location = value as {
    name?: unknown;
    latitude?: unknown;
    longitude?: unknown;
  };
  if (!isNonEmptyString(location.name)) return null;
  const latitude =
    typeof location.latitude === 'number' && Number.isFinite(location.latitude)
      ? location.latitude
      : undefined;
  const longitude =
    typeof location.longitude === 'number' &&
    Number.isFinite(location.longitude)
      ? location.longitude
      : undefined;
  return { name: location.name, latitude, longitude };
}

function isPublishedReelFeedItem(
  value: ApiReelFeedItem,
): value is ApiReelFeedItem {
  return value?.status === 'published' && isRemoteMediaUrl(value.playbackUrl);
}

function isPublishedContentClipFeedItem(
  value: unknown,
): value is ApiContentClipFeedItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ApiContentClipFeedItem>;
  const author = item.author;
  return (
    isNonEmptyString(item.id) &&
    item.format === 'clip' &&
    item.mediaType === 'video' &&
    (item.status === undefined || item.status === 'published') &&
    item.visibility === 'public' &&
    isRemoteMediaUrl(item.playbackUrl) &&
    isNonEmptyString(item.duplicateClusterId) &&
    Boolean(author) &&
    (author?.type === 'user' ||
      author?.type === 'provider' ||
      author?.type === 'business') &&
    isNonEmptyString(author?.id) &&
    isNonEmptyString(author?.name)
  );
}

function contentMusicLabel(music: ApiContentClipFeedItem['music']): string {
  if (!music || !isNonEmptyString(music.title)) return '';
  const title = music.title.trim();
  return isNonEmptyString(music.artist) ? `${title} · ${music.artist.trim()}` : title;
}

/** Convert a profile-backed content post into the stable visual Clip shape. */
export function mapApiContentClipToItem(
  item: ApiContentClipFeedItem,
): ReelItem {
  const author = item.author;
  return {
    id: item.id,
    // `title` drives the feed's "♪" label. Only Clips with on-device music
    // carry one; everything else keeps the honest "Original audio" fallback.
    title: contentMusicLabel(item.music),
    author: author.name,
    authorAvatarUrl: isRemoteMediaUrl(author.avatarUrl)
      ? author.avatarUrl
      : undefined,
    authorProfile: {
      type: author.type === 'user' ? 'user' : 'business',
      id: author.id,
    },
    reportTarget: { kind: 'content_post', id: item.id },
    feedSource: 'content_post',
    contentMetadata: {
      hashtags: stringArray(item.hashtags),
      taggedUserIds: stringArray(item.taggedUserIds),
      location: contentLocation(item.location),
      visibility: item.visibility,
      duplicateClusterId: item.duplicateClusterId,
      publishedAt: isNonEmptyString(item.publishedAt)
        ? item.publishedAt
        : isNonEmptyString(item.createdAt)
        ? item.createdAt
        : null,
      viewCount: nonNegativeNumber(item.viewCount),
      shareCount: nonNegativeNumber(item.shareCount),
    },
    caption: typeof item.caption === 'string' ? item.caption : '',
    videoUrl: item.playbackUrl,
    posterUrl: isRemoteMediaUrl(item.posterUrl) ? item.posterUrl : '',
    likeCount: nonNegativeNumber(item.likeCount),
    commentCount: nonNegativeNumber(item.commentCount),
    liked: item.viewerHasLiked === true,
  };
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
function mergePublishedClipFeeds(
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

export function useServiceTreesQuery(fallback: ApiServiceTree[]) {
  return useQuery({
    queryKey: ['catalog', 'trees', isApiEnabled ? 'api' : 'mock'],
    queryFn: async () => {
      if (!isApiEnabled) return fallback;
      await ensureAuthToken();
      const res = await apiRequest<{ data: ApiServiceTree[] }>(
        '/v1/catalog/trees',
      );
      return res.data;
    },
    initialData: isApiEnabled ? undefined : fallback,
    staleTime: 60_000,
  });
}

export function useCmsBannersQuery() {
  return useQuery({
    queryKey: ['cms', 'banners', isApiEnabled ? 'api' : 'mock'],
    queryFn: async () => {
      if (!isApiEnabled) return MOCK_CMS_BANNERS;
      const res = await apiRequest<{ data: ApiCmsBanner[] }>(
        '/v1/media/banners',
      );
      const live = res.data.filter(b => Boolean(b.imageUrl));
      return live.length ? live : MOCK_CMS_BANNERS;
    },
    initialData: MOCK_CMS_BANNERS,
    placeholderData: MOCK_CMS_BANNERS,
    staleTime: 60_000,
  });
}

export function useServiceCategoriesQuery(
  treeId: string | undefined,
  fallback: ApiServiceCategory[],
) {
  return useQuery({
    queryKey: [
      'catalog',
      'categories',
      treeId ?? 'all',
      isApiEnabled ? 'api' : 'mock',
    ],
    queryFn: async () => {
      if (!isApiEnabled) return fallback;
      await ensureAuthToken();
      const qs = treeId ? `?treeId=${encodeURIComponent(treeId)}` : '';
      const res = await apiRequest<{ data: ApiServiceCategory[] }>(
        `/v1/catalog/categories${qs}`,
      );
      return res.data;
    },
    initialData: isApiEnabled ? undefined : fallback,
    staleTime: 60_000,
  });
}

/**
 * In development this is the checked-in Cloudflare R2 Clip catalog. It keeps
 * local UI work pointed at the same remote delivery layer as production,
 * while production only accepts the server-personalized feed.
 */
export function useReelsQuery() {
  return useQuery({
    queryKey: ['reels', 'feed', 'content-first', 'api'],
    queryFn: async () => {
      await ensureAuthToken();

      const [contentResult, legacyResult] = await Promise.allSettled([
        apiRequest<ApiContentClipFeedResponse>('/v1/content/feeds/clip'),
        apiRequest<{ data: ApiReelFeedItem[] }>('/v1/reels'),
      ]);

      const contentClips =
        contentResult.status === 'fulfilled' &&
        Array.isArray(contentResult.value.items)
          ? contentResult.value.items
              .filter(isPublishedContentClipFeedItem)
              .map(mapApiContentClipToItem)
          : [];
      const legacyReels =
        legacyResult.status === 'fulfilled' &&
        Array.isArray(legacyResult.value.data)
          ? legacyResult.value.data
              .filter(isPublishedReelFeedItem)
              .map(mapApiReelToItem)
          : [];

      return mergePublishedClipFeeds(
        contentClips,
        legacyReels,
      );
    },
    staleTime: 0,
    refetchOnMount: 'always',

    // A content-feed request reserves a viewer-specific batch. Background
    // reconnects or polling would discard unseen clips, so the user refreshes
    // explicitly when ready for another batch.
    refetchOnReconnect: false,
    refetchInterval: false,
  });
}
