import React from 'react';
import Renderer from 'react-test-renderer';
import { AppState, FlatList, View } from 'react-native';
import { FlashFeedScreen } from './FlashFeedScreen';

let mockFocused = true;
let mockComments = false;
let mockAssistant = false;
let mockRefetching = false;
let mockPosts: any[];
const mockHidden: string[] = [];
const mockUpsert = jest.fn();
const mockRefetch = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
  useFocusEffect: jest.fn(),
}));
jest.mock(
  '@/shared/hooks/useTheme',
  () => require('@/test/componentMocks').themeModule,
);
jest.mock(
  'react-native-safe-area-context',
  () => require('@/test/componentMocks').safeAreaModule,
);
jest.mock('@/shared/api/config', () => ({ isApiEnabled: true }));
jest.mock('@/shared/api/storyHooks', () => ({
  useFlashPostsQuery: () => ({
    data: undefined,
    refetch: mockRefetch,
    isRefetching: mockRefetching,
  }),
}));
jest.mock('@/shared/publishing/useActiveProfile', () => ({
  useActiveProfile: () => ({ active: null }),
}));
jest.mock('@/shared/services/engagementRepository', () => ({
  useEngagementStore: (select: any) =>
    select({
      posts: mockPosts,
      hiddenIds: mockHidden,
      upsertApiPosts: mockUpsert,
    }),
}));
jest.mock('@/shared/store/commentsSheetStore', () => ({
  useCommentsSheetStore: (select: any) =>
    select({ open: mockComments, closing: false }),
}));
jest.mock('@/features/assistant/store/assistantStore', () => ({
  useAssistantStore: (select: any) => select({ open: mockAssistant }),
}));
jest.mock('@/shared/navigation/FloatingPillTabBar', () => ({
  TAB_BAR_VISIBLE_HEIGHT: 66,
}));
jest.mock('@/shared/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('@/shared/components/FilterPills', () => ({
  FilterPills: () => null,
}));
jest.mock('@/features/flash/components/FlashComposerBar', () => ({
  FlashComposerBar: () => null,
}));
jest.mock('@/features/flash/components/StoryTray', () => ({
  StoryTray: () => null,
}));
jest.mock('@/features/flash/components/FlashPostCard', () => ({
  FlashPostCard: (props: any) =>
    require('react').createElement('feed-post', props),
}));
let tree: Renderer.ReactTestRenderer;
let appStateListener: (state: string) => void;
const post = (id: string) => ({
  id,
  media: [{ id: id + '-video', type: 'video', url: id + '.mp4' }],
  feedTabs: ['forYou'],
});
const cards = () => tree.root.findAll(n => n.type === ('feed-post' as any));
const card = (id: string) => cards().find(n => n.props.post.id === id)!;
const active = () =>
  cards()
    .filter(n => n.props.playbackActive)
    .map(n => n.props.post.id);
const layout = (height = 600) =>
  Renderer.act(() =>
    tree.root
      .findByType(FlatList)
      .props.onLayout({ nativeEvent: { layout: { height } } }),
  );
const scroll = (y: number) =>
  Renderer.act(() =>
    tree.root
      .findByType(FlatList)
      .props.onScroll({ nativeEvent: { contentOffset: { y } } }),
  );
const rerender = () => Renderer.act(() => tree.update(<FlashFeedScreen />));
function geometry(id: string, rowY: number, mediaY = 100, mediaHeight = 300) {
  Renderer.act(() => {
    const cell = tree.root.findAll(
      n =>
        typeof n.type === 'function' &&
        n.type.name === 'FeedCell' &&
        n.props.item.id === id,
    )[0];
    expect(cell).toBeDefined();
    cell.findAllByType(View)[0].props.onLayout({
      nativeEvent: {
        layout: {
          y: rowY,
          height: mediaY + mediaHeight + 100,
          width: 400,
          x: 0,
        },
      },
    });
    card(id).props.onMediaLayout(id, { y: mediaY, height: mediaHeight });
  });
}
beforeEach(() => {
  mockRefetching = false;
  mockFocused = true;
  mockComments = false;
  mockAssistant = false;
  mockPosts = [post('one'), post('two')];
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active',
  });
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_: any, listener: any) => {
      appStateListener = listener;
      return { remove: jest.fn() };
    });
  Renderer.act(() => {
    tree = Renderer.create(<FlashFeedScreen />);
  });
});
afterEach(() => {
  Renderer.act(() => tree.unmount());
  jest.restoreAllMocks();
});

test('only measured sufficiently visible media can own playback and scroll changes the owner', () => {
  expect(active()).toEqual([]);
  layout();
  geometry('one', 0);
  geometry('two', 500);
  expect(active()).toEqual(['one']);
  scroll(500);
  expect(active()).toEqual(['two']);
  scroll(2000);
  expect(active()).toEqual([]);
  scroll(0);
  expect(active()).toEqual(['one']);
});

test('focus, app background, assistant, comments, and per-card covering overlays pause playback', () => {
  layout();
  geometry('one', 0);
  geometry('two', 500);
  expect(active()).toEqual(['one']);
  mockFocused = false;
  rerender();
  expect(active()).toEqual([]);
  mockFocused = true;
  rerender();
  expect(active()).toEqual(['one']);
  Renderer.act(() => appStateListener('background'));
  expect(active()).toEqual([]);
  Renderer.act(() => appStateListener('active'));
  expect(active()).toEqual(['one']);
  mockComments = true;
  rerender();
  expect(active()).toEqual([]);
  mockComments = false;
  mockAssistant = true;
  rerender();
  expect(active()).toEqual([]);
  mockAssistant = false;
  rerender();
  expect(active()).toEqual(['one']);
  Renderer.act(() => card('one').props.onOverlayChange('share-one', true));
  expect(active()).toEqual([]);
  Renderer.act(() => card('one').props.onOverlayChange('share-one', false));
  expect(active()).toEqual(['one']);
});

test('removed or reordered rows cannot inherit stale geometry during refresh', () => {
  layout();
  geometry('one', 0);
  geometry('two', 500);
  scroll(500);
  expect(active()).toEqual(['two']);
  mockPosts = [post('two')];
  rerender();
  expect(active()).toEqual([]);
  // Its new cell geometry is still outside the viewport until the list reports the new offset.
  geometry('two', 0);
  scroll(0);
  expect(active()).toEqual(['two']);
});

test('refresh and rapid scroll across pagination never leave two owners or a hidden owner', () => {
  layout();
  geometry('one', 0);
  geometry('two', 500);
  mockRefetching = true;
  rerender();
  expect(active()).toEqual([]);
  mockRefetching = false;
  rerender();
  expect(active()).toEqual(['one']);
  mockPosts = [...mockPosts, post('three')];
  rerender();
  geometry('three', 1000);
  for (const [offset, owner] of [
    [1000, 'three'],
    [0, 'one'],
    [500, 'two'],
    [3000, null],
    [1000, 'three'],
  ] as const) {
    scroll(offset);
    expect(active()).toEqual(owner ? [owner] : []);
  }
  const staleMediaCallback = card('three').props.onMediaLayout;
  mockPosts = [post('one'), post('two')];
  rerender();
  Renderer.act(() => staleMediaCallback('three', { y: 100, height: 300 }));
  expect(active()).toEqual([]);
});

test('bounds silent preparation to the next nearby post and clears it for overlays and fast scroll', () => {
  layout();
  geometry('one', 0);
  geometry('two', 500);
  expect(card('one').props.playbackActive).toBe(true);
  expect(card('two').props.preparationEnabled).toBe(true);
  scroll(500);
  expect(card('two').props.playbackActive).toBe(true);
  expect(cards().filter(n => n.props.preparationEnabled)).toHaveLength(0);
  scroll(0);
  mockComments = true;
  rerender();
  expect(cards().filter(n => n.props.preparationEnabled)).toHaveLength(0);
  mockComments = false;
  rerender();
  scroll(3000);
  expect(
    cards().filter(n => n.props.preparationEnabled || n.props.playbackActive),
  ).toHaveLength(0);
});
