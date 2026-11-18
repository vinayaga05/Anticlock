import {
  buildLoopedClipFeed,
  clipPlayerWindowState,
  loopCompleteClipsFeedWhenExhausted,
  mergeLoadedReelPages,
  nextClipFeedIndex,
  visibleClipFeedPage,
} from './clipFeedLoop';
import type { ReelItem } from '@/shared/types';

function reel(id: string): ReelItem {
  return { id, videoUrl: `https://cdn.test/${id}.mp4` } as ReelItem;
}

describe('temporary Clips feed loop', () => {
  it('cycles 1 → 2 → 3 → 1 → 2 → 3 without duplicate keys', () => {
    expect(loopCompleteClipsFeedWhenExhausted).toBe(true);
    const loaded = [reel('1'), reel('2'), reel('3')];
    expect(buildLoopedClipFeed(loaded, false).map(entry => entry.reel.id)).toEqual([
      '1', '2', '3',
    ]);
    const looped = buildLoopedClipFeed(loaded, true);

    expect(looped.map(entry => entry.reel.id)).toEqual(['1', '2', '3', '1']);
    expect(new Set(looped.map(entry => entry.key)).size).toBe(looped.length);
    expect(looped[3]).toMatchObject({ sourceIndex: 0, loopSentinel: true });

    let index = 0;
    const played: string[] = [];
    for (let step = 0; step < 6; step += 1) {
      played.push(loaded[index].id);
      index = nextClipFeedIndex(index, loaded.length);
    }
    expect(played).toEqual(['1', '2', '3', '1', '2', '3']);
  });

  it('rebuilds the loop after refresh with a newly published clip first', () => {
    const refreshed = buildLoopedClipFeed([
      reel('4'),
      reel('1'),
      reel('2'),
      reel('3'),
    ], true);
    expect(refreshed.map(entry => entry.reel.id)).toEqual(['4', '1', '2', '3', '4']);
    expect(new Set(refreshed.map(entry => entry.key)).size).toBe(5);
  });

  it('merges paginated server pages without duplicate Reel IDs', () => {
    const merged = mergeLoadedReelPages([
      [reel('4'), reel('3')],
      [reel('3'), reel('2')],
      [reel('1')],
    ]);
    expect(merged.map(item => item.id)).toEqual(['4', '3', '2', '1']);
  });

  it('does not duplicate an empty or single-clip feed', () => {
    expect(buildLoopedClipFeed([])).toEqual([]);
    expect(buildLoopedClipFeed([reel('only')]).map(entry => entry.reel.id)).toEqual(['only']);
    expect(nextClipFeedIndex(0, 1)).toBe(0);
  });

  it('keeps exactly one native player and releases both neighbouring pages', () => {
    const states = Array.from({ length: 20 }, (_, index) =>
      clipPlayerWindowState(index, 8),
    );
    expect(states.filter(Boolean)).toHaveLength(1);
    expect(states[7]).toBeNull();
    expect(states[8]).toBe('active');
    expect(states[9]).toBeNull();
    expect(states[10]).toBeNull();
  });

  it('clears the active page in the threshold gap during a quick swipe', () => {
    const entries = buildLoopedClipFeed([reel('1'), reel('2')]);
    expect(visibleClipFeedPage(entries, [
      { index: 0, key: entries[0].key, isViewable: true },
    ])).toEqual({ index: 0, key: entries[0].key });
    expect(visibleClipFeedPage(entries, [])).toBeNull();
    expect(visibleClipFeedPage(entries, [
      { index: 0, key: entries[0].key, isViewable: false },
    ])).toBeNull();
    expect(visibleClipFeedPage(entries, [
      { index: 1, key: entries[1].key, isViewable: true },
    ])).toEqual({ index: 1, key: entries[1].key });
  });

  it('rejects stale row tokens after refresh, reorder or removal', () => {
    const entries = buildLoopedClipFeed([reel('new'), reel('1'), reel('2')]);
    const oldFirstRow = { index: 0, key: 'clip:1', isViewable: true };
    expect(visibleClipFeedPage(entries, [oldFirstRow])).toBeNull();
    expect(visibleClipFeedPage([], [oldFirstRow])).toBeNull();
    expect(visibleClipFeedPage(entries, [
      { index: null, key: entries[0].key },
      { index: 20, key: 'clip:removed' },
      { index: 1, key: entries[1].key },
    ])).toEqual({ index: 1, key: entries[1].key });
  });

  it('distinguishes the visible loop sentinel from its off-screen canonical row', () => {
    const entries = buildLoopedClipFeed([reel('1'), reel('2')]);
    expect(visibleClipFeedPage(entries, [
      { index: 2, key: entries[2].key, isViewable: true },
    ])).toEqual({ index: 2, key: 'clip:1:loop-sentinel' });
    expect(visibleClipFeedPage(entries, [
      { index: 2, key: entries[0].key, isViewable: true },
    ])).toBeNull();
  });
});
