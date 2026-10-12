import type { ReelItem } from '@/shared/types';

/**
 * Only a published profile Clip the server marked as manageable by this
 * viewer can be deleted; editorial/legacy Reels never offer Delete.
 */
export function canDeleteClip(reel: ReelItem | null | undefined): boolean {
  return reel?.feedSource === 'content_post' && reel.viewerCanManage === true;
}

/** Drops Clips the viewer just deleted without waiting for a refetch. */
export function withoutHiddenClips(
  reels: readonly ReelItem[],
  hiddenIds: ReadonlySet<string>,
): ReelItem[] {
  if (hiddenIds.size === 0) return reels as ReelItem[];
  return reels.filter(reel => !hiddenIds.has(reel.id));
}
