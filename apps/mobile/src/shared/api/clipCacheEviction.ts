import type { QueryClient } from '@tanstack/react-query';
import { withoutHiddenClips } from '@/features/reels/screens/clipOwnership';
import { contentQueryKeys } from '@/shared/publishing/contentQueryKeys';
import type { ReelItem } from '@/shared/types';

/**
 * After an owner delete, drop the Clip from every cached Clip list right away
 * (feed and profile players), then refetch the profile / content queries so
 * grids and counts reflect the server. The personalized feed is not refetched
 * so the viewer's position in it is kept.
 */
export function evictDeletedClipFromCaches(queryClient: QueryClient, id: string) {
  const hidden = new Set([id]);
  queryClient.setQueriesData<ReelItem[]>(
    { queryKey: contentQueryKeys.clipsFeed },
    data => (Array.isArray(data) ? withoutHiddenClips(data, hidden) : data),
  );
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['reels', 'profile'] }),
    queryClient.invalidateQueries({ queryKey: contentQueryKeys.all }),
  ]);
}
