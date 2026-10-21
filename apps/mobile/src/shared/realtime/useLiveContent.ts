import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/shared/api/client';
import {
  isPublishedContentClipFeedItem,
  mapApiContentClipToItem,
} from '@/shared/api/hooks';
import { contentQueryKeys } from '@/shared/publishing/contentQueryKeys';
import type { PublisherProfileType } from '@/shared/publishing/publisherSelection';
import type { ReelItem } from '@/shared/types';
import {
  setLiveViewerProfile,
  startLiveContent,
  subscribeLiveContent,
  type LiveContentEvent,
} from './contentStream';
import {
  insertClipsAtTop,
  newestPublishedAt,
  queuePendingClips,
  removeClipFromPages,
  withoutPending,
  type ClipFeedData,
} from './liveClipMerge';

const CLIP_FEED_KEY = ['reels', 'feed'] as const;

function profileTypeOf(value: string): PublisherProfileType | null {
  return value === 'personal' || value === 'business' ? value : null;
}

/** Live item from the stream as a feed clip, or null if not playable. */
export function liveClipItem(raw: unknown): ReelItem | null {
  return isPublishedContentClipFeedItem(raw) ? mapApiContentClipToItem(raw) : null;
}

function dropRemovedClip(queryClient: QueryClient, id: string) {
  queryClient.setQueriesData<ClipFeedData>({ queryKey: CLIP_FEED_KEY }, data =>
    data && Array.isArray(data.pages) ? removeClipFromPages(data, id) : data,
  );
  queryClient.setQueriesData<ReelItem[]>({ queryKey: ['reels', 'profile'] }, data =>
    Array.isArray(data) ? data.filter(item => item.id !== id) : data,
  );
}

/**
 * App-wide live sync, mounted once for a signed-in session: keeps the
 * stream open and refreshes profile grids, counts and the author's own
 * lists whenever content is published or removed. Feed insertion is left
 * to the Clips screen so the playing video is never replaced.
 */
export function useLiveContentSync(
  enabled: boolean,
  viewerProfile?: { id: string; type: PublisherProfileType },
) {
  const queryClient = useQueryClient();
  const viewerType = viewerProfile?.type;
  const viewerId = viewerProfile?.id;

  useEffect(() => {
    setLiveViewerProfile(
      viewerType && viewerId ? { type: viewerType, id: viewerId } : undefined,
    );
  }, [viewerId, viewerType]);

  useEffect(() => {
    if (!enabled) return;
    const stop = startLiveContent();
    const unsubscribe = subscribeLiveContent(event => {
      if (event.type === 'resync') return;
      if (event.type === 'post.removed') dropRemovedClip(queryClient, event.id);
      const type = profileTypeOf(event.publisherProfileType);
      if (type && event.publisherProfileId) {
        queryClient
          .invalidateQueries({
            queryKey: contentQueryKeys.profile(type, event.publisherProfileId),
          })
          .catch(() => undefined);
      }
      queryClient
        .invalidateQueries({ queryKey: contentQueryKeys.mine })
        .catch(() => undefined);
      queryClient
        .invalidateQueries({ queryKey: ['reels', 'profile'] })
        .catch(() => undefined);
    });
    return () => {
      unsubscribe();
      stop();
    };
  }, [enabled, queryClient]);
}

/**
 * Clips feed: live arrivals wait behind a pill instead of shifting the
 * feed; `showPending` puts them at the top. Removals disappear at once.
 * On reconnect / foreground it catches up with `?since=` the newest clip.
 */
export function useLivePendingClips(options: {
  enabled: boolean;
  loadedReels: readonly ReelItem[];
  viewerSuffix: string;
}) {
  const { enabled, loadedReels, viewerSuffix } = options;
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<ReelItem[]>([]);
  const loadedRef = useRef(loadedReels);
  loadedRef.current = loadedReels;
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const queue = useCallback((items: ReelItem[]) => {
    if (!items.length) return;
    const loadedIds = new Set(loadedRef.current.map(item => item.id));
    setPending(previous => queuePendingClips(previous, items, loadedIds));
  }, []);

  const catchUp = useCallback(async () => {
    const since = newestPublishedAt([...loadedRef.current, ...pendingRef.current]);
    if (!since) return;
    try {
      const response = await apiRequest<{ items?: unknown[] }>(
        `/v1/content/feeds/clip?limit=20&since=${encodeURIComponent(since)}${viewerSuffix}`,
      );
      const items = (response.items ?? []).flatMap(raw => {
        const item = liveClipItem(raw);
        return item ? [item] : [];
      });
      queue(items);
    } catch {
      // next resync retries
    }
  }, [queue, viewerSuffix]);

  useEffect(() => {
    if (!enabled) return;
    return subscribeLiveContent((event: LiveContentEvent) => {
      if (event.type === 'resync') {
        catchUp().catch(() => undefined);
        return;
      }
      if (event.format !== 'clip') return;
      if (event.type === 'post.removed') {
        setPending(previous => withoutPending(previous, event.id));
        return;
      }
      const item = liveClipItem(event.item);
      if (item) queue([item]);
    });
  }, [catchUp, enabled, queue]);

  // Something already in the feed (pull to refresh, own upload) no longer waits.
  useEffect(() => {
    if (!pending.length) return;
    const loadedIds = new Set(loadedReels.map(item => item.id));
    if (pending.some(item => loadedIds.has(item.id))) {
      setPending(previous => previous.filter(item => !loadedIds.has(item.id)));
    }
  }, [loadedReels, pending]);

  const showPending = useCallback(() => {
    const items = pendingRef.current;
    if (!items.length) return [];
    queryClient.setQueriesData<ClipFeedData>({ queryKey: CLIP_FEED_KEY }, data =>
      data && Array.isArray(data.pages) ? insertClipsAtTop(data, items) : data,
    );
    setPending([]);
    return items;
  }, [queryClient]);

  /** Shared links: fetch one clip and put it at the top of the feed. */
  const revealClip = useCallback(
    async (id: string) => {
      const response = await apiRequest<{ post?: unknown }>(
        `/v1/content/posts/${encodeURIComponent(id)}${viewerSuffix ? `?${viewerSuffix.slice(1)}` : ''}`,
      );
      const item = liveClipItem(response.post);
      if (!item) return false;
      queryClient.setQueriesData<ClipFeedData>({ queryKey: CLIP_FEED_KEY }, data =>
        data && Array.isArray(data.pages) ? insertClipsAtTop(data, [item]) : data,
      );
      return true;
    },
    [queryClient, viewerSuffix],
  );

  return { pending, showPending, revealClip };
}
