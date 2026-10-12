import {
  buildLoopedClipFeed,
  loopCompleteClipsFeedWhenExhausted,
  mergeLoadedReelPages,
  nextClipFeedIndex,
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
});
