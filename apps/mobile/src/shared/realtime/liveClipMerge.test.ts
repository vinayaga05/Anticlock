import {
  backoffDelay,
  insertClipsAtTop,
  newestPublishedAt,
  parseSseChunk,
  queuePendingClips,
  removeClipFromPages,
  withoutPending,
  type ClipFeedData,
} from '@/shared/realtime/liveClipMerge';
import { clipShareUrl } from '@/features/reels/feed/clipShare';
import type { ReelItem } from '@/shared/types';

function clip(id: string, publishedAt: string | null = null): ReelItem {
  return {
    id,
    title: '',
    author: 'creator',
    caption: id,
    videoUrl: `https://cdn.example/${id}.mp4`,
    posterUrl: '',
    likeCount: 0,
    commentCount: 0,
    contentMetadata: {
      hashtags: [],
      taggedUserIds: [],
      location: null,
      visibility: 'public',
      duplicateClusterId: id,
      publishedAt,
      viewCount: 0,
      shareCount: 0,
    },
  } as ReelItem;
}

function feed(...pages: ReelItem[][]): ClipFeedData {
  return {
    pages: pages.map((items, index) => ({
      items,
      nextCursor: index < pages.length - 1 ? `c${index}` : null,
    })),
    pageParams: pages.map((_, index) => (index ? `c${index - 1}` : null)),
  };
}

const ids = (items: readonly ReelItem[]) => items.map(item => item.id);

describe('live clip queue', () => {
  it('orders arrivals newest first and skips clips already in the feed', () => {
    const pending = queuePendingClips(
      [clip('b', '2026-10-21T10:00:01Z')],
      [clip('c', '2026-10-21T10:00:03Z'), clip('loaded', '2026-10-21T10:00:05Z'), clip('a', '2026-10-21T10:00:00Z')],
      new Set(['loaded']),
    );
    expect(ids(pending)).toEqual(['c', 'b', 'a']);
  });

  it('dedupes a repeated arrival and keeps the latest copy', () => {
    const first = clip('x', '2026-10-21T10:00:00Z');
    const updated = { ...clip('x', '2026-10-21T10:00:00Z'), likeCount: 4 };
    const pending = queuePendingClips([first], [updated], new Set());
    expect(pending).toHaveLength(1);
    expect(pending[0]?.likeCount).toBe(4);
  });

  it('drops a waiting clip that was deleted before it was shown', () => {
    const pending = [clip('a'), clip('b')];
    expect(ids(withoutPending(pending, 'a'))).toEqual(['b']);
    expect(withoutPending(pending, 'zzz')).toBe(pending);
  });
});

describe('feed cache updates', () => {
  it('inserts new clips at the top and removes their older copies', () => {
    const data = feed([clip('p1'), clip('p2')], [clip('n1'), clip('p3')]);
    const next = insertClipsAtTop(data, [
      clip('n1', '2026-10-21T10:00:00Z'),
      clip('n2', '2026-10-21T10:00:09Z'),
    ]);
    expect(ids(next!.pages[0]!.items)).toEqual(['n2', 'n1', 'p1', 'p2']);
    expect(ids(next!.pages[1]!.items)).toEqual(['p3']);
    expect(next!.pages[1]!.nextCursor).toBeNull();
  });

  it('leaves missing or empty data alone', () => {
    expect(insertClipsAtTop(undefined, [clip('a')])).toBeUndefined();
    const data = feed([clip('a')]);
    expect(insertClipsAtTop(data, [])).toBe(data);
  });

  it('removes a deleted clip from every page and keeps identity when absent', () => {
    const data = feed([clip('a'), clip('b')], [clip('c')]);
    const next = removeClipFromPages(data, 'c');
    expect(ids(next!.pages[1]!.items)).toEqual([]);
    expect(next!.pages[0]).toBe(data.pages[0]);
    expect(removeClipFromPages(data, 'nope')).toBe(data);
  });

  it('uses the newest publish time as the catch-up cursor', () => {
    expect(
      newestPublishedAt([
        clip('a', '2026-10-21T10:00:00Z'),
        clip('b', '2026-10-21T11:00:00Z'),
        clip('c', null),
      ]),
    ).toBe('2026-10-21T11:00:00Z');
    expect(newestPublishedAt([clip('c', null)])).toBeNull();
  });
});

describe('stream helpers', () => {
  it('parses events across chunk boundaries and ignores heartbeats', () => {
    const first = parseSseChunk('', 'event: ready\ndata: {"at":"x"}\n\n: ping\n\nevent: post.pub');
    expect(first.messages).toEqual([{ event: 'ready', data: '{"at":"x"}', id: undefined }]);
    const second = parseSseChunk(first.carry, 'lished\nid: 1\ndata: {"id":"a"}\n\n');
    expect(second.messages).toEqual([{ event: 'post.published', data: '{"id":"a"}', id: '1' }]);
    expect(second.carry).toBe('');
  });

  it('backs off exponentially with a cap', () => {
    expect(backoffDelay(0, () => 1)).toBe(1000);
    expect(backoffDelay(3, () => 1)).toBe(8000);
    expect(backoffDelay(20, () => 1)).toBe(30000);
    expect(backoffDelay(20, () => 0)).toBe(15000);
  });

  it('builds a shareable clip link', () => {
    expect(clipShareUrl('abc')).toBe('https://anticlock.online/reels/abc');
  });
});
