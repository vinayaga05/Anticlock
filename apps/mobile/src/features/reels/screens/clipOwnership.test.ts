import { canDeleteClip, withoutHiddenClips } from './clipOwnership';
import type { ReelItem } from '@/shared/types';

function reel(id: string, overrides: Partial<ReelItem> = {}): ReelItem {
  return {
    id,
    videoUrl: `https://cdn.test/${id}.mp4`,
    feedSource: 'content_post',
    ...overrides,
  } as ReelItem;
}

describe('clip ownership', () => {
  it('offers Delete only for content Clips the viewer can manage', () => {
    expect(canDeleteClip(reel('1', { viewerCanManage: true }))).toBe(true);
    expect(canDeleteClip(reel('2', { viewerCanManage: false }))).toBe(false);
    expect(canDeleteClip(reel('3'))).toBe(false);
    expect(
      canDeleteClip(
        reel('4', { viewerCanManage: true, feedSource: 'legacy_reel' }),
      ),
    ).toBe(false);
    expect(canDeleteClip(null)).toBe(false);
    expect(canDeleteClip(undefined)).toBe(false);
  });

  it('hides deleted Clips locally and keeps order', () => {
    const all = [reel('a'), reel('b'), reel('c')];
    expect(withoutHiddenClips(all, new Set())).toBe(all);
    expect(withoutHiddenClips(all, new Set(['b'])).map(r => r.id)).toEqual([
      'a',
      'c',
    ]);
  });
});
