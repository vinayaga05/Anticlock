import { useQuery } from '@tanstack/react-query';
import { apiRequest, setApiToken } from './client';
import { isApiEnabled } from './config';
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

async function ensureMobileToken() {
  const deviceId = 'dev-device-anticlock';
  const session = await apiRequest<{
    userId: string;
    displayName: string;
    token: string;
    expiresAt: string;
  }>('/auth/mobile/token', {
    method: 'POST',
    body: JSON.stringify({ deviceId, displayName: 'Mobile Dev' }),
  });
  setApiToken(session.token);
  return session;
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
      await ensureMobileToken();
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
      await ensureMobileToken();
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
        await ensureMobileToken();
        const res = await apiRequest<{ data: ApiReelFeedItem[] }>('/v1/reels');
        if (res.data.length) return res.data.map(mapApiReelToItem);
      }
      return loadClipsReels(fallback);
    },
    initialData: fallback,
    staleTime: 30_000,
  });
}
