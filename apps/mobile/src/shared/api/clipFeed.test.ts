import {
  mergeClipFeedItems,
  publishedEditorialReels,
} from '@/shared/api/clipFeedMerge';
import type { ReelItem } from '@/shared/types';

function reel(id: string): ReelItem {
  return {
    id,
    title: id,
    author: 'studio',
    caption: 'caption',
    videoUrl: `https://cdn.example/${id}.mp4`,
    posterUrl: '',
    likeCount: 0,
    commentCount: 0,
  };
}

describe('published editorial clips', () => {
  it('keeps published clips with a remote video and drops the rest', () => {
    const items = publishedEditorialReels([
      {
        id: 'yoga',
        status: 'published',
        title: 'Yoga flow',
        caption: 'Morning stretch',
        creatorName: 'wellness.studio',
        playbackUrl: 'https://cdn.example/yoga.mp4',
        posterUrl: null,
        likeCount: 0,
        commentCount: 0,
        saveCount: 0,
        cta: null,
      },
      {
        id: 'draft',
        status: 'draft',
        title: 'Draft',
        creatorName: 'studio',
        playbackUrl: 'https://cdn.example/draft.mp4',
        posterUrl: null,
        likeCount: 0,
        commentCount: 0,
        saveCount: 0,
        cta: null,
      },
      {
        id: 'local',
        status: 'published',
        title: 'Local',
        creatorName: 'studio',
        playbackUrl: '/videos/local.mp4',
        posterUrl: null,
        likeCount: 0,
        commentCount: 0,
        saveCount: 0,
        cta: null,
      },
    ]);

    expect(items.map(item => item.id)).toEqual(['yoga']);
    expect(items[0]?.videoUrl).toBe('https://cdn.example/yoga.mp4');
    expect(items[0]?.author).toBe('wellness.studio');
  });

  it('shows profile clips first and appends editorial clips once', () => {
    const merged = mergeClipFeedItems(
      [reel('profile')],
      [reel('profile'), reel('yoga')],
    );
    expect(merged.map(item => item.id)).toEqual(['profile', 'yoga']);
  });
});
