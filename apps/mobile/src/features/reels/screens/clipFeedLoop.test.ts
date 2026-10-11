import {
  buildLoopedClipFeed,
  loopClipsFeedWhenExhausted,
  nextClipFeedIndex,
} from './clipFeedLoop';
import type { ReelItem } from '@/shared/types';

function reel(id: string): ReelItem {
  return { id, videoUrl: `https://cdn.test/${id}.mp4` } as ReelItem;
}

describe('temporary Clips feed loop', () => {
  it('cycles 1 → 2 → 3 → 1 → 2 → 3 without duplicate keys', () => {
    expect(loopClipsFeedWhenExhausted).toBe(true);
    const loaded = [reel('1'), reel('2'), reel('3')];
    const looped = buildLoopedClipFeed(loaded);

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

  it('rebuilds the sentinel from refreshed server data including clip 4', () => {
    const refreshed = buildLoopedClipFeed([
      reel('1'),
      reel('2'),
      reel('3'),
      reel('4'),
    ]);
    expect(refreshed.map(entry => entry.reel.id)).toEqual(['1', '2', '3', '4', '1']);
    expect(new Set(refreshed.map(entry => entry.key)).size).toBe(5);
  });

  it('does not duplicate an empty or single-clip feed', () => {
    expect(buildLoopedClipFeed([])).toEqual([]);
    expect(buildLoopedClipFeed([reel('only')]).map(entry => entry.reel.id)).toEqual(['only']);
    expect(nextClipFeedIndex(0, 1)).toBe(0);
  });
});
