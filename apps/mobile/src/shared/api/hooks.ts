import { useQuery } from '@tanstack/react-query';
import { apiRequest, ApiError } from './client';
import { isApiEnabled } from './config';
import { readStoredSession } from '@/shared/services/auth/authService';
import { loadClipsReels } from '@/shared/data/cloudflareVideos';
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
    queryKey: ['reels', 'feed', isApiEnabled ? 'api' : 'r2'],
    queryFn: async () => {
      if (isApiEnabled) {
        await ensureAuthToken();
        const res = await apiRequest<{ data: ApiReelFeedItem[] }>('/v1/reels');
        if (res.data.length) return res.data.map(mapApiReelToItem);
      }
      // Always bypass CDN/browser cache so pull-to-refresh gets new R2 uploads.
      return loadClipsReels(fallback, { bustCache: true });
    },
    initialData: fallback,
    staleTime: 30_000,
  });
}
