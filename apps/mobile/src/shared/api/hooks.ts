import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiRequest, ApiError } from './client';
import { isApiEnabled } from './config';
import { readStoredSession } from '@/shared/services/auth/authService';
import type { ApiContentPost, ApiContentPostsResponse } from '@/shared/publishing/contentPostMappers';
import type { PublisherProfileType } from '@/shared/publishing/publisherSelection';
import type { ReelItem } from '@/shared/types';
import {
  mergeClipFeedItems,
  publishedEditorialReels,
} from '@/shared/api/clipFeedMerge';

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
  /** True when the viewer owns (or manages the business that owns) it. */
  viewerCanManage?: boolean;
  shareCount: number;
  createdAt: string;
  publishedAt: string;
  publisherProfileId: string;
  publisherProfileType: PublisherProfileType;
  publisher: {
    id: string;
    type: PublisherProfileType;
    displayName: string;
    handle: string | null;
    avatarUrl: string | null;
    verified: boolean;
    businessCategory: string | null;
  };
  relationship?: {
    followStatus: 'not_following' | 'requested' | 'following' | 'blocked';
    isFollowing: boolean;
    isRequested: boolean;
    isBlocked: boolean;
    canViewContent: boolean;
  };
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

export function isPublishedContentClipFeedItem(
  value: unknown,
): value is ApiContentClipFeedItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ApiContentClipFeedItem>;
  const author = item.author;
  const publisher = item.publisher;
  return (
    isNonEmptyString(item.id) &&
    item.format === 'clip' &&
    item.mediaType === 'video' &&
    (item.status === undefined || item.status === 'published') &&
    (item.visibility === 'public' || item.visibility === 'followers') &&
    isRemoteMediaUrl(item.playbackUrl) &&
    isNonEmptyString(item.duplicateClusterId) &&
    Boolean(author) &&
    (author?.type === 'user' ||
      author?.type === 'provider' ||
      author?.type === 'business') &&
    isNonEmptyString(author?.id) &&
    isNonEmptyString(author?.name) &&
    Boolean(publisher) &&
    isNonEmptyString(publisher?.id) &&
    isNonEmptyString(publisher?.displayName) &&
    (publisher?.type === 'personal' || publisher?.type === 'business')
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
  const publisher = item.publisher;
  return {
    id: item.id,
    // `title` drives the feed's "♪" label. Only Clips with on-device music
    // carry one; everything else keeps the honest "Original audio" fallback.
    title: contentMusicLabel(item.music),
    author: publisher.displayName,
    authorAvatarUrl: isRemoteMediaUrl(publisher.avatarUrl)
      ? publisher.avatarUrl
      : undefined,
    authorProfile: {
      type: publisher.type === 'personal' ? 'user' : 'business',
      id: publisher.id,
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
    viewerCanManage: item.viewerCanManage === true,
  };
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
    queryKey: ['cms', 'banners', 'api'],
    queryFn: async () => {
      if (!isApiEnabled) return [];
      const res = await apiRequest<{ data: ApiCmsBanner[] }>(
        '/v1/media/banners',
      );
      return res.data.filter(b => Boolean(b.imageUrl));
    },
    staleTime: 60_000,
  });
}

export function useServiceCategoriesQuery(
  treeId: string | undefined,
  fallback: ApiServiceCategory[],
  providerKind?: 'business' | 'individual',
) {
  return useQuery({
    queryKey: [
      'catalog',
      'categories',
      treeId ?? 'all',
      providerKind ?? 'any',
      isApiEnabled ? 'api' : 'mock',
    ],
    queryFn: async () => {
      if (!isApiEnabled) return fallback;
      await ensureAuthToken();
      const params = new URLSearchParams();
      if (treeId) params.set('treeId', treeId);
      if (providerKind) params.set('providerKind', providerKind);
      const query = params.toString();
      const qs = query ? `?${query}` : '';
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
 * Converts a profile post into the Clip-player model without depending on the
 * personalized feed. Profile playback must retain the profile's own sequence.
 */
export function mapApiProfileClipToItem(item: ApiContentPost): ReelItem | null {
  const playbackUrl = item.media?.find(media => media.kind === 'video')?.url;
  if (!playbackUrl || item.format !== 'clip' || item.mediaType !== 'video') {
    return null;
  }
  const publisher = item.publisher;
  const author = publisher
    ? {
        type: publisher.type === 'business' ? ('business' as const) : ('user' as const),
        id: publisher.id,
        name: publisher.displayName,
        avatarUrl: publisher.avatarUrl,
      }
    : item.author;
  return {
    id: item.id,
    title: '',
    author: author.name,
    authorAvatarUrl: author.avatarUrl ?? undefined,
    authorProfile: { type: author.type === 'provider' ? 'business' : author.type, id: author.id },
    reportTarget: { kind: 'content_post', id: item.id },
    feedSource: 'content_post',
    contentMetadata: {
      hashtags: [],
      taggedUserIds: [],
      location: null,
      visibility: item.visibility,
      duplicateClusterId: item.id,
      publishedAt: item.publishedAt ?? item.createdAt,
      viewCount: item.viewCount ?? 0,
      shareCount: item.shareCount ?? 0,
    },
    caption: item.caption,
    videoUrl: playbackUrl,
    posterUrl: item.posterUrl ?? '',
    likeCount: item.likeCount ?? 0,
    commentCount: item.commentCount ?? 0,
    liked: item.viewerHasLiked === true,
    viewerCanManage: item.viewerCanManage === true,
  };
}

/** Removes the viewer's own Clip everywhere (server sets it to removed). */
export async function deleteContentClip(id: string): Promise<void> {
  await ensureAuthToken();
  await apiRequest(`/v1/content/posts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/** Clips published by one profile, in the profile's chronological order. */
export function useProfileClipReelsQuery(
  profileType: PublisherProfileType | undefined,
  profileId: string | undefined,
) {
  return useQuery({
    queryKey: ['reels', 'profile', profileType ?? '', profileId ?? ''],
    queryFn: async (): Promise<ReelItem[]> => {
      const response = await apiRequest<ApiContentPostsResponse>(
        `/v1/content/profiles/${profileType}/${profileId}/posts?format=clip&limit=30`,
      );
      return (response.items ?? response.data ?? [])
        .map(mapApiProfileClipToItem)
        .filter((item): item is ReelItem => item !== null);
    },
    enabled: isApiEnabled && Boolean(profileType && profileId),
    staleTime: 15_000,
  });
}

/** Complete, server-ordered Clip feed with cursor pagination. */
export function useReelsQuery(
  enabled = true,
  viewerProfile?: { id: string; type: PublisherProfileType },
) {
  return useInfiniteQuery({
    queryKey: [
      'reels',
      'feed',
      'complete-published',
      viewerProfile?.type ?? 'personal',
      viewerProfile?.id ?? 'default',
      'api',
    ],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<{
      items: ReelItem[];
      nextCursor: string | null;
    }> => {
      const cursor = typeof pageParam === 'string' ? pageParam : null;
      const cursorSuffix = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      const viewerSuffix = viewerProfile
        ? `&viewerProfileType=${encodeURIComponent(viewerProfile.type)}&viewerProfileId=${encodeURIComponent(viewerProfile.id)}`
        : '';
      let contentItems: ReelItem[] = [];
      let nextCursor: string | null = null;
      let contentError: unknown = null;
      try {
        await ensureAuthToken();
        const response = await apiRequest<ApiContentClipFeedResponse>(
          `/v1/content/feeds/clip?limit=20${cursorSuffix}${viewerSuffix}`,
        );
        contentItems = Array.isArray(response.items)
          ? response.items
              .filter(isPublishedContentClipFeedItem)
              .map(mapApiContentClipToItem)
          : [];
        nextCursor = response.nextCursor;
      } catch (error) {
        contentError = error;
      }
      // The published catalog lives on GET /v1/reels. The profile feed can be
      // empty, so the first page keeps those clips visible.
      if (!cursor) {
        try {
          const editorial = await apiRequest<{ data?: unknown }>('/v1/reels');
          const items = mergeClipFeedItems(
            contentItems,
            publishedEditorialReels(editorial.data),
          );
          if (items.length > 0 || !contentError) {
            return { items, nextCursor: contentError ? null : nextCursor };
          }
        } catch {
          // Editorial clips only fill the catalog; never fail the feed for them.
        }
      }
      if (contentError) throw contentError;
      return { items: contentItems, nextCursor };
    },
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    enabled: enabled && isApiEnabled,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchInterval: false,
  });
}
