import { useStoryStore } from './storyStore';
import type { UserStory } from './storyTypes';

jest.mock('@/shared/api/config', () => ({ isApiEnabled: true }));
const now = Date.parse('2026-11-18T12:00:00Z');
const own = { id: 'real-user', type: 'personal' as const, name: 'Vinay' };
const group = (authorId: string, expiry = now + 60_000): UserStory => ({
  authorId,
  author: {
    id: authorId,
    name: authorId,
    avatarUrl: '',
    profileType: 'personal',
  },
  source: 'api',
  audience: 'public',
  items: [
    {
      id: `item-${authorId}`,
      type: 'text',
      textContent: 'Hello',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(expiry).toISOString(),
    },
  ],
});
beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(now);
  useStoryStore.setState({
    viewerProfile: null,
    stories: [],
    archive: [],
    viewedByAuthor: {},
  });
});
afterEach(() => jest.restoreAllMocks());

it('puts the active real publishing profile first even before it has a story', () => {
  const store = useStoryStore.getState();
  store.setViewerProfile(own);
  store.setApiStories([group('other')]);
  expect(
    store.getAllTrayEntries().map(entry => [entry.authorId, entry.isOwn]),
  ).toEqual([
    ['real-user', true],
    ['other', false],
  ]);
});

it('an authoritative empty response removes stale stories and a profile switch clears old audience data', () => {
  const store = useStoryStore.getState();
  store.setViewerProfile(own);
  store.setApiStories([group('real-user'), group('other')]);
  store.markItemViewed('other', 'item-other');
  store.setViewerProfile({
    id: 'business',
    type: 'business',
    name: 'Business',
  });
  expect(useStoryStore.getState().stories).toEqual([]);
  expect(useStoryStore.getState().viewedByAuthor).toEqual({});
  store.setApiStories([group('other')]);
  store.setApiStories([]);
  expect(store.getAllTrayEntries()).toHaveLength(1);
  expect(store.getAllTrayEntries()[0]?.authorId).toBe('business');
});

it('drops expired remote stories without adding someone else’s story to a private archive', () => {
  const store = useStoryStore.getState();
  store.setViewerProfile(own);
  store.setApiStories([group('other', now - 1)]);
  store.pruneExpired();
  expect(useStoryStore.getState().stories[0]?.items).toEqual([]);
  expect(useStoryStore.getState().archive).toEqual([]);
});

it('removes deleted story items immediately from the current tray', () => {
  const store = useStoryStore.getState();
  store.setViewerProfile(own);
  store.setApiStories([group('real-user')]);
  store.removeStoryItem('item-real-user');
  expect(store.getAllTrayEntries()[0]?.hasActiveStory).toBe(false);
});
