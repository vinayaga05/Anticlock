import {
  mapApiFlashPost,
  mapApiStoriesToUserStories,
  relativeTimeLabel,
  type ApiContentPost,
} from './contentPostMappers';

const now = Date.parse('2026-10-08T12:00:00.000Z');
const business = {
  id: '22222222-2222-4222-8222-222222222222',
  type: 'business' as const,
  displayName: 'Lotus Yoga',
  handle: 'lotusyoga',
  avatarUrl: 'https://cdn.example/logo.png',
  verified: true,
  businessCategory: 'Yoga Studio',
};

function post(overrides: Partial<ApiContentPost>): ApiContentPost {
  return {
    id: 'p1',
    format: 'flash',
    mediaType: 'image',
    caption: 'Morning class',
    mediaIds: ['m1'],
    media: [{ id: 'm1', kind: 'image', url: 'https://cdn.example/a.jpg' }],
    thumbnailMediaId: null,
    posterUrl: null,
    visibility: 'public',
    publisherProfileId: business.id,
    publisherProfileType: 'business',
    publisher: business,
    // Legacy author block mirrors the publisher, never the owner user.
    author: { type: 'provider', id: business.id, name: business.displayName, avatarUrl: business.avatarUrl },
    likeCount: 3,
    commentCount: 1,
    shareCount: 0,
    viewerHasLiked: true,
    viewerCanManage: false,
    createdAt: '2026-10-08T10:00:00.000Z',
    publishedAt: '2026-10-08T10:00:00.000Z',
    expiresAt: null,
    ...overrides,
  };
}

describe('mapApiFlashPost', () => {
  it('shows the business publisher as the author', () => {
    const mapped = mapApiFlashPost(post({}), now);
    expect(mapped.author).toMatchObject({
      id: business.id,
      name: 'Lotus Yoga',
      avatarUrl: business.avatarUrl,
      isProvider: true,
      profileType: 'business',
      businessCategory: 'Yoga Studio',
    });
    expect(mapped.source).toBe('api');
    expect(mapped.publisherProfileType).toBe('business');
    expect(mapped.viewerReaction).toBe('like');
    expect(mapped.reactionCounts.like).toBe(3);
    expect(mapped.media[0]).toMatchObject({ type: 'image', url: 'https://cdn.example/a.jpg' });
    expect(mapped.timeLabel).toBe('2h');
  });

  it('maps text posts without media', () => {
    const mapped = mapApiFlashPost(post({ mediaType: 'text', media: [], mediaIds: [] }), now);
    expect(mapped.media).toEqual([]);
    expect(mapped.text).toBe('Morning class');
  });
});

describe('mapApiStoriesToUserStories', () => {
  it('groups live stories per publisher and drops expired ones', () => {
    const stories = mapApiStoriesToUserStories(
      [
        post({ id: 's2', format: 'story', publishedAt: '2026-10-08T11:00:00.000Z', expiresAt: '2026-10-09T11:00:00.000Z' }),
        post({ id: 's1', format: 'story', publishedAt: '2026-10-08T09:00:00.000Z', expiresAt: '2026-10-09T09:00:00.000Z' }),
        post({ id: 'old', format: 'story', expiresAt: '2026-10-08T11:59:00.000Z' }),
      ],
      now,
    );
    expect(stories).toHaveLength(1);
    expect(stories[0]!.authorId).toBe(business.id);
    expect(stories[0]!.author.name).toBe('Lotus Yoga');
    expect(stories[0]!.source).toBe('api');
    expect(stories[0]!.items.map(item => item.id)).toEqual(['s1', 's2']);
    expect(stories[0]!.items[0]!.mediaUrl).toBe('https://cdn.example/a.jpg');
  });
});

describe('relativeTimeLabel', () => {
  it('formats recent times compactly', () => {
    expect(relativeTimeLabel('2026-10-08T11:59:30.000Z', now)).toBe('now');
    expect(relativeTimeLabel('2026-10-08T11:15:00.000Z', now)).toBe('45m');
    expect(relativeTimeLabel('2026-10-05T12:00:00.000Z', now)).toBe('3d');
  });
});
