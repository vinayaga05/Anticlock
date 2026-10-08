import type { ReelItem } from '@/shared/types';
import {
  appendClipPage,
  canDeleteClip,
  clipAuthorLabel,
  clipShareUrl,
  prependClip,
  withoutHiddenClips,
} from './clipFeedPaging';

function clip(id: string, extra: Partial<ReelItem> = {}): ReelItem {
  return {
    id,
    title: '',
    author: 'Asha Rao',
    caption: '',
    videoUrl: `https://media.example.com/${id}.mp4`,
    posterUrl: '',
    likeCount: 0,
    commentCount: 0,
    feedSource: 'content_post',
    contentMetadata: {
      hashtags: [],
      taggedUserIds: [],
      location: null,
      visibility: 'public',
      duplicateClusterId: `cluster-${id}`,
      publishedAt: null,
      viewCount: 0,
      shareCount: 0,
    },
    ...extra,
  } as ReelItem;
}

describe('clip feed paging', () => {
  it('appends a new page after the current clips', () => {
    const result = appendClipPage([clip('a'), clip('b')], [clip('c'), clip('d')]);
    expect(result.items.map(item => item.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(result.added).toBe(2);
  });

  it('skips clips the viewer already has (id, video or cluster)', () => {
    const sameVideo = clip('x', { videoUrl: 'https://media.example.com/a.mp4?sig=2' });
    const result = appendClipPage([clip('a'), clip('b')], [clip('b'), sameVideo, clip('c')]);
    expect(result.items.map(item => item.id)).toEqual(['a', 'b', 'c']);
    expect(result.added).toBe(1);
  });

  it('reports zero added when a page only repeats clips', () => {
    expect(appendClipPage([clip('a')], [clip('a')]).added).toBe(0);
  });

  it('puts a linked clip first only once', () => {
    const items = [clip('a'), clip('b')];
    expect(prependClip(items, clip('z')).map(item => item.id)).toEqual(['z', 'a', 'b']);
    expect(prependClip(items, clip('b'))).toBe(items);
  });

  it('hides deleted or reported clips locally', () => {
    const items = [clip('a'), clip('b'), clip('c')];
    expect(withoutHiddenClips(items, new Set(['b'])).map(item => item.id)).toEqual(['a', 'c']);
    expect(withoutHiddenClips(items, new Set())).toBe(items);
  });

  it('offers delete only to the owner of a profile clip', () => {
    expect(canDeleteClip(clip('a', { viewerCanManage: true }))).toBe(true);
    expect(canDeleteClip(clip('a', { viewerCanManage: false }))).toBe(false);
    expect(canDeleteClip(clip('a'))).toBe(false);
    expect(
      canDeleteClip(clip('a', { viewerCanManage: true, feedSource: 'legacy_reel' })),
    ).toBe(false);
    expect(canDeleteClip(null)).toBe(false);
  });

  it('builds a universal share link', () => {
    expect(clipShareUrl('53178d99-4452')).toBe('https://anticlock.online/reels/53178d99-4452');
  });

  it('labels profile clips by name and editorial reels by handle', () => {
    expect(clipAuthorLabel({ author: 'Asha Rao', feedSource: 'content_post' })).toBe('Asha Rao');
    expect(clipAuthorLabel({ author: 'coach.sathish', feedSource: 'legacy_reel' })).toBe('@coach.sathish');
  });
});
