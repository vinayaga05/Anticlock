import React from 'react';
import Renderer from 'react-test-renderer';
import { Alert, AppState, FlatList, Share } from 'react-native';
import { ReelFeedScreen } from './ReelFeedScreen';
import { VideoPlayer } from '@/features/video/components/VideoPlayer';
import { ClipMoreSheet } from '../components/ClipMoreSheet';
import { GuidedReportVideoSheet } from '../components/GuidedReportVideoSheet';
import { feedMediaMemory } from '@/features/video/playback/feedMediaMemory';

let mockFocused = true;
let mockAssistantOpen = false;
const mockComments = { open: false, closing: false, playbackActive: true, openComments: jest.fn() };
const mockReels = ['one', 'two', 'three'].map(id => ({
  id, author: id, caption: id, videoUrl: `https://cdn.test/${id}.mp4`,
  likeCount: 0, commentCount: 0,
}));
const mockQuery = {
  data: { pages: [{ items: mockReels }] }, hasNextPage: false,
  isFetchingNextPage: false, isLoading: false, isSuccess: true,
  refetch: jest.fn().mockResolvedValue(undefined), fetchNextPage: jest.fn(),
};
const mockNavigation = { navigate: jest.fn(), goBack: jest.fn() };
const mockLive = { pending: [], showPending: jest.fn(), revealClip: jest.fn() };
const mockCommentCounts = {};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ name: 'PlayFeed' }),
  useIsFocused: () => mockFocused,
}));
jest.mock('@/features/video/components/VideoPlayer', () => ({ VideoPlayer: () => null }));
jest.mock('../components/ClipMoreSheet', () => ({ ClipMoreSheet: () => null }));
jest.mock('../components/GuidedReportVideoSheet', () => ({ GuidedReportVideoSheet: () => null }));
jest.mock('@/features/assistant/store/assistantStore', () => ({
  useAssistantStore: (select: any) => select({ open: mockAssistantOpen }),
}));
jest.mock('@/shared/store/commentsSheetStore', () => ({
  useCommentsSheetStore: (select: any) => select(mockComments),
}));
jest.mock('@/shared/services/engagementRepository', () => ({
  useEngagementStore: (select: any) => select({ commentCounts: mockCommentCounts }),
}));
jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/AppIcon', () => require('@/test/componentMocks').appIconModule);
jest.mock('@/shared/components/PressableScale', () => require('@/test/componentMocks').pressableScaleModule);
jest.mock('react-native-safe-area-context', () => require('@/test/componentMocks').safeAreaModule);
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View, Defs: View, LinearGradient: View, Rect: View, Stop: View };
});
jest.mock('@/shared/navigation/businessNavigation', () => ({ navigateToProfile: jest.fn() }));
jest.mock('@/shared/navigation/tabBarInset', () => ({ useTabBarBottomInset: () => 20 }));
jest.mock('@/shared/navigation/CommentsBottomSheetHost', () => ({ CommentsBottomSheetHost: () => null }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }));
jest.mock('@/shared/api/hooks', () => ({
  useReelsQuery: () => mockQuery,
  useProviderCategoryClipsQuery: () => mockQuery,
  useProfileClipReelsQuery: () => ({ data: [] }),
  deleteContentClip: jest.fn(),
}));
jest.mock('@/shared/api/clipCacheEviction', () => ({ evictDeletedClipFromCaches: jest.fn() }));
jest.mock('@/shared/realtime/useLiveContent', () => ({ useLivePendingClips: () => mockLive }));
jest.mock('@/shared/api/reelSafety', () => ({
  listBlockedProfiles: () => Promise.resolve([]), blockProfile: jest.fn(), reportContentPost: jest.fn(), reportReel: jest.fn(),
}));
jest.mock('@/shared/api/storyHooks', () => ({ useContentProfileQuery: () => ({}) }));
jest.mock('@/shared/api/profileFollows', () => ({ useProfileFollowMutation: () => ({}) }));
jest.mock('@/shared/api/messagesClient', () => ({ createOrGetChannel: jest.fn() }));
jest.mock('@/shared/providers/StreamChatProvider', () => ({ useStreamChat: () => ({}) }));
jest.mock('@/shared/publishing/useActiveProfile', () => ({ useActiveProfile: () => ({}) }));
jest.mock('@/shared/api/reelAnalytics', () => ({
  createAnalyticsEventId: () => 'test-session',
  recordClipPlaybackPerformance: () => Promise.resolve(), recordReelAnalyticsEvent: () => Promise.resolve(),
}));
jest.mock('@/shared/api/contentEngagement', () => ({
  recordContentClipView: () => Promise.resolve(), setContentClipLike: () => Promise.resolve(),
}));

let tree: Renderer.ReactTestRenderer;
let appStateChanged: (state: string) => void;
const players = () => tree.root.findAllByType(VideoPlayer);
const list = () => tree.root.findByType(FlatList);
async function render() {
  await Renderer.act(async () => { tree = Renderer.create(<ReelFeedScreen />); });
}
function update() {
  Renderer.act(() => tree.update(<ReelFeedScreen />));
}
function view(index: number | null) {
  Renderer.act(() => {
    const entries = list().props.data;
    list().props.onViewableItemsChanged({
      viewableItems: index == null ? [] : [{
        index, key: entries[index].key, item: entries[index], isViewable: true,
      }],
    });
  });
}
function press(label: string) {
  Renderer.act(() => {
    tree.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0].props.onPress();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockFocused = true;
  mockAssistantOpen = false;
  mockComments.open = false;
  mockComments.closing = false;
  mockQuery.data = { pages: [{ items: mockReels }] };
  mockQuery.refetch.mockReset().mockResolvedValue(undefined);
  AppState.currentState = 'active';
  feedMediaMemory.clear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event: any, listener: any) => {
    appStateChanged = listener;
    return { remove: jest.fn() };
  });
});
afterEach(() => {
  Renderer.act(() => tree?.unmount());
  jest.clearAllTimers();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('retains a paused decoder through visibility gaps and replaces it on a new page', async () => {
  await render();
  expect(players()).toHaveLength(0);
  view(0);
  expect(players()).toHaveLength(1);
  expect(players()[0].props.uri).toBe(mockReels[0].videoUrl);
  const decoder = players()[0];
  const staleProgress = players()[0].props.onPlaybackProgress;
  view(null);
  expect(players()).toHaveLength(1);
  expect(players()[0].props.paused).toBe(true);
  view(0);
  expect(players()[0]).toBe(decoder);
  expect(players()[0].props.paused).toBe(false);
  view(1);
  expect(players()).toHaveLength(1);
  expect(players()[0].props.uri).toBe(mockReels[1].videoUrl);
  staleProgress(22, 30);
  expect(feedMediaMemory.get('clip:one').position).toBe(0);
});

it('restores each clip mute, manual pause and position after cell recycling', async () => {
  await render();
  view(0);
  Renderer.act(() => {
    players()[0].props.onMutedChange(true);
    players()[0].props.onPlaybackProgress(3, 30);
    players()[0].props.onPausedChange(true);
  });
  view(1);
  expect(players()[0].props.muted).toBe(false);
  expect(players()[0].props.paused).toBe(false);
  view(0);
  expect(players()[0].props.muted).toBe(true);
  expect(players()[0].props.paused).toBe(true);
  expect(players()[0].props.initialPositionSeconds).toBe(3);
});

it('pauses the retained player for tab blur, app background, comments and the assistant', async () => {
  await render();
  view(0);
  const decoder = players()[0];
  mockFocused = false;
  update();
  expect(players()).toHaveLength(1);
  expect(players()[0].props.paused).toBe(true);
  mockFocused = true;
  update();
  expect(players()).toHaveLength(1);
  Renderer.act(() => appStateChanged('background'));
  expect(players()).toHaveLength(1);
  expect(players()[0].props.paused).toBe(true);
  Renderer.act(() => appStateChanged('active'));
  expect(players()).toHaveLength(1);
  expect(players()[0]).toBe(decoder);
  mockComments.open = true; // Even partial comments with playbackActive=true cover the feed.
  update();
  expect(players()).toHaveLength(1);
  expect(players()[0].props.paused).toBe(true);
  mockComments.open = false;
  mockComments.closing = true;
  update();
  expect(players()).toHaveLength(1);
  expect(players()[0].props.paused).toBe(true);
  mockComments.closing = false;
  mockAssistantOpen = true;
  update();
  expect(players()).toHaveLength(1);
  expect(players()[0].props.paused).toBe(true);
  mockAssistantOpen = false;
  update();
  expect(players()).toHaveLength(1);
  expect(players()[0]).toBe(decoder);
  expect(players()[0].props.paused).toBe(false);
});

it('pauses throughout the more menu, report sheet and native caption alert', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render();
  view(0);
  press('More options');
  expect(players()).toHaveLength(1);
  expect(players()[0].props.paused).toBe(true);
  Renderer.act(() => tree.root.findByType(ClipMoreSheet).props.onAction('report'));
  expect(players()).toHaveLength(1);
  expect(players()[0].props.paused).toBe(true);
  expect(tree.root.findByType(GuidedReportVideoSheet).props.visible).toBe(true);
  Renderer.act(() => tree.root.findByType(GuidedReportVideoSheet).props.onClose());
  expect(players()).toHaveLength(1);
  press('More options');
  Renderer.act(() => tree.root.findByType(ClipMoreSheet).props.onAction('caption'));
  expect(players()).toHaveLength(1);
  expect(players()[0].props.paused).toBe(true);
  Renderer.act(() => alert.mock.calls[0][2]![0].onPress!());
  expect(players()).toHaveLength(1);
});

it('pauses during native sharing and resumes the same visible clip on dismissal', async () => {
  let dismiss!: () => void;
  jest.spyOn(Share, 'share').mockImplementation(() => new Promise(resolve => {
    dismiss = () => resolve({ action: Share.dismissedAction });
  }));
  await render();
  view(0);
  press('Share');
  expect(players()).toHaveLength(1);
  expect(players()[0].props.paused).toBe(true);
  await Renderer.act(async () => dismiss());
  expect(players()).toHaveLength(1);
  expect(players()[0].props.uri).toBe(mockReels[0].videoUrl);
});

it('resumes an unchanged first row after refresh without requiring a new viewability event', async () => {
  let finish!: () => void;
  mockQuery.refetch.mockImplementationOnce(() => new Promise(resolve => {
    finish = () => resolve(undefined);
  }));
  await render();
  view(0);
  let refresh: Promise<void>;
  Renderer.act(() => { refresh = list().props.refreshControl.props.onRefresh(); });
  expect(players()).toHaveLength(1);
  expect(players()[0].props.paused).toBe(true);
  await Renderer.act(async () => { finish(); await refresh; });
  expect(players()).toHaveLength(1);
  expect(players()[0].props.uri).toBe(mockReels[0].videoUrl);
});

it('keeps pagination on the same owner and rejects displaced rows after refresh or removal', async () => {
  mockQuery.data = { pages: [{ items: mockReels.slice(0, 2) }] };
  await render();
  view(1);
  mockQuery.data = { pages: [{ items: mockReels.slice(0, 2) }, { items: [mockReels[2]] }] };
  update();
  expect(players()).toHaveLength(1);
  expect(players()[0].props.uri).toBe(mockReels[1].videoUrl);
  const displacedToken = { index: 1, key: 'clip:two', isViewable: true };
  const newClip = { ...mockReels[0], id: 'new', videoUrl: 'https://cdn.test/new.mp4' };
  mockQuery.data = { pages: [{ items: [newClip, ...mockReels] }] };
  update();
  expect(players()).toHaveLength(1);
  expect(players()[0].props.paused).toBe(true);
  Renderer.act(() => list().props.onViewableItemsChanged({ viewableItems: [displacedToken] }));
  expect(players()).toHaveLength(1);
  expect(players()[0].props.paused).toBe(true);
  view(2);
  expect(players()[0].props.uri).toBe(mockReels[1].videoUrl);
  mockQuery.data = { pages: [{ items: [newClip] }] };
  update();
  expect(players()).toHaveLength(0);
  view(0);
  expect(players()).toHaveLength(1);
  expect(players()[0].props.uri).toBe(newClip.videoUrl);
});
