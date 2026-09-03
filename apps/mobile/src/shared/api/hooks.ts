import { useQuery } from '@tanstack/react-query';
import { apiRequest, ApiError } from './client';
import { isApiEnabled } from './config';
import { readStoredSession } from '@/shared/services/auth/authService';
import type { ReelItem } from '@/shared/types';
import {
  fetchR2ReelsManifest,
  buildClipsReelsFromManifest,
  mergeReelFeeds,
} from '@/shared/data/cloudflareVideos';

const CANVA_REEL_TEMPLATE: ReelItem = {
  id: 'canva-template',
  title: 'Clip',
  author: 'anticlock',
  caption: '',
  videoUrl: '',
  posterUrl: '',
  likeCount: 0,
  commentCount: 0,
};

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
  status: 'published';
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
    entityType: 'provider' | 'event' | 'course' | 'product' | 'service_category';
    entityId: string;
    ctaLabel?: string;
  } | null;
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
    author: r.creatorName,
    caption: r.caption ?? '',
    videoUrl: r.playbackUrl,
    posterUrl: r.posterUrl ?? '',
    likeCount: r.likeCount,
    commentCount: r.commentCount,
    bookTarget,
  };
}

function isR2PlaybackUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host.endsWith('.r2.dev') || host.includes('r2.cloudflarestorage.com');
  } catch {
    return false;
  }
}

function isPublishedReelFeedItem(
  value: ApiReelFeedItem,
): value is ApiReelFeedItem {
  return (
    value?.status === 'published' &&
    Boolean(value.playbackUrl) &&
    isR2PlaybackUrl(value.playbackUrl)
  );
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
      const res = await apiRequest<{ data: ApiCmsBanner[] }>('/v1/media/banners');
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

export function useReelsQuery(fallback: ReelItem[]) {
  return useQuery({
    queryKey: ['reels', 'feed', isApiEnabled ? 'api' : 'mock'],
    queryFn: async () => {
      // The public feed is API-authoritative in release builds. In particular,
      // never substitute a bucket manifest when it is empty or unavailable:
      // an object in storage is not necessarily a published Reel.
      if (!isApiEnabled) return fallback;

      let published: ReelItem[] = [];
      try {
        const res = await apiRequest<{ data: ApiReelFeedItem[] }>('/v1/reels');
        // Treat the server's explicit publication signal as a second guard. A
        // malformed or unexpectedly broad response must not surface a draft,
        // review, or raw storage asset in the Clips feed.
        published = res.data
          .filter(isPublishedReelFeedItem)
          .map(mapApiReelToItem);
      } catch {
        // Still try canva/ R2 clips below so a transient API error does not
        // blank the entire Clips tab when bucket videos are available.
      }

      // Surface canva/ R2 clips immediately after upload, even before an
      // operator runs importR2Clips on the VPS. Only canva/ keys are merged.
      const manifest = await fetchR2ReelsManifest({ bustCache: true });
      if (!manifest) return published;

      const canvaManifest = {
        ...manifest,
        videos: (manifest.videos ?? []).filter(entry => {
          const key = entry.objectKey ?? '';
          const url = entry.playbackUrl ?? '';
          return (
            key.startsWith('canva/') ||
            url.includes('/canva/') ||
            url.includes('%2Fcanva%2F')
          );
        }),
      };
      if (!canvaManifest.videos.length) return published;

      const canvaReels = buildClipsReelsFromManifest(canvaManifest, [
        ...published,
        CANVA_REEL_TEMPLATE,
      ]);
      return mergeReelFeeds(published, canvaReels);
    },
    // Keep a concrete empty value in API-enabled builds so consumers cannot
    // substitute mock Reels while the request is loading or has failed.
    // Mark it stale immediately so it does not delay the first API request.
    initialData: isApiEnabled ? [] : fallback,
    initialDataUpdatedAt: isApiEnabled ? 0 : undefined,
    staleTime: isApiEnabled ? 0 : 30_000,
    refetchOnMount: isApiEnabled ? 'always' : true,
    refetchOnReconnect: true,
    // Moderation/unpublish actions should disappear from an open feed without
    // relying on a raw R2 object list or a full app restart.
    refetchInterval: isApiEnabled ? 30_000 : false,
  });
}
