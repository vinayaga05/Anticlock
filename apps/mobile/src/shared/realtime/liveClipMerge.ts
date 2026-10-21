import type { InfiniteData } from '@tanstack/react-query';
import type { ReelItem } from '@/shared/types';

export type ClipFeedPage = { items: ReelItem[]; nextCursor: string | null };
export type ClipFeedData = InfiniteData<ClipFeedPage, string | null>;

function publishedTime(item: ReelItem) {
  const at = item.contentMetadata?.publishedAt;
  const ms = at ? Date.parse(at) : NaN;
  return Number.isFinite(ms) ? ms : 0;
}

/** Newest first; ties keep a stable id order. */
export function sortNewestFirst(items: readonly ReelItem[]): ReelItem[] {
  return [...items].sort(
    (a, b) => publishedTime(b) - publishedTime(a) || (a.id < b.id ? 1 : -1),
  );
}

/**
 * Adds live arrivals to the waiting list behind the "new clips" pill.
 * Items already in the feed or already waiting are ignored; a repeated
 * arrival replaces the waiting copy so counts and captions stay current.
 */
export function queuePendingClips(
  pending: readonly ReelItem[],
  incoming: readonly ReelItem[],
  loadedIds: ReadonlySet<string>,
): ReelItem[] {
  const byId = new Map(pending.map(item => [item.id, item]));
  for (const item of incoming) {
    if (loadedIds.has(item.id)) continue;
    byId.set(item.id, item);
  }
  return sortNewestFirst([...byId.values()]);
}

/** Drops one id from the waiting list (deleted before it was shown). */
export function withoutPending(pending: readonly ReelItem[], id: string) {
  return pending.some(item => item.id === id)
    ? pending.filter(item => item.id !== id)
    : (pending as ReelItem[]);
}

/**
 * Puts new clips at the top of the first loaded page and removes any copy
 * of them further down, so the feed never shows one clip twice.
 */
export function insertClipsAtTop(
  data: ClipFeedData | undefined,
  items: readonly ReelItem[],
): ClipFeedData | undefined {
  if (!data || !data.pages.length || !items.length) return data;
  const fresh = sortNewestFirst(items);
  const ids = new Set(fresh.map(item => item.id));
  const pages = data.pages.map((page, index) => {
    const rest = page.items.filter(item => !ids.has(item.id));
    return index === 0
      ? { ...page, items: [...fresh, ...rest] }
      : rest.length === page.items.length
      ? page
      : { ...page, items: rest };
  });
  return { ...data, pages };
}

/** Removes one clip from every loaded page. Unchanged data keeps identity. */
export function removeClipFromPages(
  data: ClipFeedData | undefined,
  id: string,
): ClipFeedData | undefined {
  if (!data) return data;
  let changed = false;
  const pages = data.pages.map(page => {
    if (!page.items.some(item => item.id === id)) return page;
    changed = true;
    return { ...page, items: page.items.filter(item => item.id !== id) };
  });
  return changed ? { ...data, pages } : data;
}

/** Newest publish time already known, used as the catch-up cursor. */
export function newestPublishedAt(items: readonly ReelItem[]): string | null {
  let best = 0;
  let iso: string | null = null;
  for (const item of items) {
    const ms = publishedTime(item);
    if (ms > best) {
      best = ms;
      iso = item.contentMetadata?.publishedAt ?? null;
    }
  }
  return iso;
}

/** Reconnect delay: exponential with jitter, capped. */
export function backoffDelay(attempt: number, random = Math.random) {
  const base = Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt));
  return Math.round(base / 2 + random() * (base / 2));
}

export type SseMessage = { event: string; data: string; id?: string };

/**
 * Incremental Server-Sent Events parser. Feed it text chunks; it returns
 * complete messages and keeps the unfinished tail. Comment lines (":")
 * are heartbeats and produce no message.
 */
export function parseSseChunk(
  carry: string,
  chunk: string,
): { messages: SseMessage[]; carry: string } {
  const text = (carry + chunk).replace(/\r\n/g, '\n');
  const blocks = text.split('\n\n');
  const rest = blocks.pop() ?? '';
  const messages: SseMessage[] = [];
  for (const block of blocks) {
    let event = 'message';
    let id: string | undefined;
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon < 0 ? line : line.slice(0, colon);
      const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
      else if (field === 'id') id = value;
    }
    if (data.length) messages.push({ event, data: data.join('\n'), id });
  }
  return { messages, carry: rest };
}
