import type { ReelItem } from '@/shared/types';

/**
 * Temporary product behavior: recycle the currently loaded Clip feed.
 * TODO: replace this with recommendation ranking, fresh-content prioritization,
 * and personalized feed logic when the final feed algorithm is ready.
 */
export const loopCompleteClipsFeedWhenExhausted = true;

export type LoopedClipFeedEntry = {
  reel: ReelItem;
  key: string;
  sourceIndex: number;
  loopSentinel: boolean;
};

export function mergeLoadedReelPages(pages: ReadonlyArray<ReadonlyArray<ReelItem>>): ReelItem[] {
  const byId = new Map<string, ReelItem>();
  for (const page of pages) {
    for (const reel of page) {
      if (!byId.has(reel.id)) byId.set(reel.id, reel);
    }
  }
  return [...byId.values()];
}

export function buildLoopedClipFeed(
  reels: ReelItem[],
  hasReachedEndOfServerFeed = true,
): LoopedClipFeedEntry[] {
  const loaded = reels.map((reel, sourceIndex) => ({
    reel,
    key: `clip:${reel.id}`,
    sourceIndex,
    loopSentinel: false,
  }));
  if (
    !loopCompleteClipsFeedWhenExhausted ||
    !hasReachedEndOfServerFeed ||
    reels.length <= 1
  ) return loaded;
  return [
    ...loaded,
    {
      reel: reels[0],
      key: `clip:${reels[0].id}:loop-sentinel`,
      sourceIndex: 0,
      loopSentinel: true,
    },
  ];
}

export function nextClipFeedIndex(currentIndex: number, loadedClipCount: number): number {
  if (loadedClipCount <= 1) return 0;
  return (Math.max(0, currentIndex) + 1) % loadedClipCount;
}
