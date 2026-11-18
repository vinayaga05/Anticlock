export type MediaBounds = { y: number; height: number };
export type FeedMediaBounds = { id: string; rowY: number; media: MediaBounds };

/** Geometry uses the media surface, not tall captions/headers around it. */
export function visibleMediaOwner(
  items: readonly FeedMediaBounds[],
  offset: number,
  viewportHeight: number,
): string | null {
  if (viewportHeight <= 0) return null;
  let winner: string | null = null;
  let best = 0;
  for (const item of items) {
    const top = item.rowY + item.media.y;
    const overlap = Math.max(
      0,
      Math.min(top + item.media.height, offset + viewportHeight) -
        Math.max(top, offset),
    );
    const required = Math.min(item.media.height, viewportHeight) * 0.6;
    if (
      overlap >= required &&
      overlap >= Math.min(64, item.media.height) &&
      overlap > best
    ) {
      winner = item.id;
      best = overlap;
    }
  }
  return winner;
}
