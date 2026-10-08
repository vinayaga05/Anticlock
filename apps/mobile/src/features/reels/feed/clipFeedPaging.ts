import type { ReelItem } from '@/shared/types';
import { mergePublishedClipFeeds } from '@/shared/api/clipFeedMerge';

/** Public link that opens a Clip in the app (anticlock.online universal link). */
export const CLIP_SHARE_BASE_URL = 'https://anticlock.online/reels/';

export function clipShareUrl(id: string): string {
  return `${CLIP_SHARE_BASE_URL}${encodeURIComponent(id)}`;
}

/**
 * Appends the next feed page after the clips already on screen. Anything the
 * viewer already has (same id, video or duplicate cluster) is skipped so the
 * list never shows the same Clip twice in a row.
 */
export function appendClipPage(
  existing: ReelItem[],
  incoming: ReelItem[],
): { items: ReelItem[]; added: number } {
  const items = mergePublishedClipFeeds(existing, incoming);
  return { items, added: items.length - existing.length };
}

/** Puts a linked Clip first unless it is already in the list. */
export function prependClip(items: ReelItem[], clip: ReelItem): ReelItem[] {
  if (items.some(item => item.id === clip.id)) return items;
  return [clip, ...items];
}

/** Ids hidden on this device until the next refresh (deleted or reported). */
export function withoutHiddenClips(
  items: ReelItem[],
  hiddenIds: ReadonlySet<string>,
): ReelItem[] {
  if (hiddenIds.size === 0) return items;
  return items.filter(item => !hiddenIds.has(item.id));
}

/** Only the owner sees Delete; legacy/editorial Reels are never deletable. */
export function canDeleteClip(item: ReelItem | null | undefined): boolean {
  return Boolean(
    item && item.feedSource === 'content_post' && item.viewerCanManage === true,
  );
}

/** Overlay name: profile Clips show the profile name, editorial ones a handle. */
export function clipAuthorLabel(item: Pick<ReelItem, 'author' | 'feedSource'>) {
  return item.feedSource === 'content_post' ? item.author : `@${item.author}`;
}
