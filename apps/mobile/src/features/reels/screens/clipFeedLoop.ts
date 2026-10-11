import type { ReelItem } from '@/shared/types';

/**
 * Temporary product behavior: recycle the currently loaded Clip feed.
 * TODO: replace this with fresh recommendations, unseen-content prioritization,
 * pagination, and server ranking when the final feed algorithm is ready.
 */
export const loopClipsFeedWhenExhausted = true;

export type LoopedClipFeedEntry = {
  reel: ReelItem;
  key: string;
  sourceIndex: number;
  loopSentinel: boolean;
};

export function buildLoopedClipFeed(reels: ReelItem[]): LoopedClipFeedEntry[] {
  const loaded = reels.map((reel, sourceIndex) => ({
    reel,
    key: `clip:${reel.id}:source:${sourceIndex}`,
    sourceIndex,
    loopSentinel: false,
  }));
  if (!loopClipsFeedWhenExhausted || reels.length <= 1) return loaded;
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
