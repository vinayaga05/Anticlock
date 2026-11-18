import React from 'react';
import Renderer from 'react-test-renderer';
import { Alert, AppState, TextInput } from 'react-native';
import { StoryViewerScreen } from './StoryViewerScreen';
import type { UserStory } from '@/shared/data/flash/storyTypes';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockReset = jest.fn();
const mockNavigate = jest.fn();
const mockSendMessage = jest.fn().mockResolvedValue({});
const mockWatch = jest.fn().mockResolvedValue({});
const mockChannel = jest.fn(() => ({
  watch: mockWatch,
  sendMessage: mockSendMessage,
}));
const mockCreateChannel = jest.fn();
const mockLike = jest.fn();
const mockInvalidate = jest.fn();
const mockNoop = () => undefined;
const mockViewed: Record<string, string[]> = {};
const mockMarkViewed = jest.fn((authorId: string, id: string) => {
  mockViewed[authorId] = [...(mockViewed[authorId] ?? []), id];
});
let mockStories: UserStory[];
const mockStore = {
  viewedByAuthor: mockViewed,
  get stories() {
    return mockStories;
  },
  getAllTrayEntries: () =>
    [...mockStories]
      .sort(
        (a, b) =>
          (mockViewed[a.authorId]?.length ?? 0) -
          (mockViewed[b.authorId]?.length ?? 0),
      )
      .map(story => ({ ...story, hasActiveStory: true })),
  markItemViewed: mockMarkViewed,
  setApiStories: mockNoop,
  removeStoryItem: jest.fn(),
};
jest.mock('@/shared/data/flash/storyStore', () => ({
  useStoryStore: (select: any) => select(mockStore),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockBack,
    navigate: mockNavigate,
    canGoBack: mockCanGoBack,
    reset: mockReset,
  }),
  useRoute: () => ({ params: { authorId: 'a' } }),
  useIsFocused: () => true,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 10 }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock('@/shared/publishing/useActiveProfile', () => ({
  useActiveProfile: () => ({ active: { id: 'me', type: 'personal' } }),
}));
jest.mock('@/shared/publishing/publisherSelection', () => ({
  identityProfileType: () => 'personal',
}));
jest.mock('@/shared/providers/StreamChatProvider', () => ({
  useStreamChat: () => ({ client: { channel: mockChannel }, isReady: true }),
}));
jest.mock('@/shared/api/messagesClient', () => ({
  createOrGetChannel: (...args: any[]) => mockCreateChannel(...args),
}));
jest.mock('@/shared/api/contentEngagement', () => ({
  setContentPostLike: (...args: any[]) => mockLike(...args),
}));
jest.mock('@/shared/api/hooks', () => ({ deleteContentClip: jest.fn() }));
jest.mock('@/shared/api/storyHooks', () => ({
  useStoriesQuery: () => ({ data: undefined }),
}));
jest.mock('@/shared/api/config', () => ({ isApiEnabled: true }));
jest.mock('@/shared/navigation/businessNavigation', () => ({
  navigateToProfile: jest.fn(),
}));
jest.mock('@/shared/components/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('@/shared/components/PressableScale', () => ({
  PressableScale: (props: any) => {
    const { Pressable } = require('react-native');
    return <Pressable {...props} />;
  },
}));
jest.mock('@/features/video/components/VideoPlayer', () => ({
  VideoPlayer: (props: any) => {
    const { View } = require('react-native');
    return <View testID="story-video" {...props} />;
  },
}));
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Defs: View,
    LinearGradient: View,
    Rect: View,
    Stop: View,
  };
});
jest.mock('react-native-reanimated', () => ({ runOnJS: (fn: any) => fn }));
jest.mock('react-native-gesture-handler', () => ({
  Gesture: { Pan: () => ({ onEnd: (fn: any) => ({ handler: fn }) }) },
  GestureDetector: ({ children, gesture }: any) => {
    const { View } = require('react-native');
    return (
      <View testID="story-pan" gesture={gesture}>
        {children}
      </View>
    );
  },
}));

let renderer: Renderer.ReactTestRenderer;
function story(authorId: string, count = 1, video = false): UserStory {
  return {
    authorId,
    author: {
      id: authorId,
      name: authorId,
      avatarUrl: 'https://example.com/a.jpg',
      profileType: 'personal',
    },
    audience: 'public',
    items: Array.from({ length: count }, (_, index) => ({
      id: `${authorId}-${index}`,
      type: video ? 'video' : 'text',
      mediaUrl: video ? 'https://example.com/a.mp4' : undefined,
      textContent: `${authorId} story ${index}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      durationMs: 5000,
    })),
  };
}
function control(label: string) {
  return renderer.root.findAll(
    node => node.props.accessibilityLabel === label && node.props.onPress,
  )[0];
}
function currentProgress() {
  return renderer.root.findByProps({ testID: 'story-progress-0' }).props
    .style[1].width;
}
function advance(ms: number) {
  Renderer.act(() => jest.advanceTimersByTime(ms));
}
beforeEach(() => {
  AppState.currentState = 'active';
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-18T00:00:00Z'));
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  Object.keys(mockViewed).forEach(key => delete mockViewed[key]);
  mockStories = [story('a'), story('b')];
  mockCreateChannel.mockResolvedValue({
    channelId: 'real-channel',
    profile: { id: 'a', type: 'personal', displayName: 'a' },
  });
  mockLike.mockResolvedValue({ liked: true });
});
afterEach(() => {
  if (renderer) Renderer.act(() => renderer.unmount());
  jest.useRealTimers();
});
function mount() {
  Renderer.act(() => {
    renderer = Renderer.create(<StoryViewerScreen />);
  });
}

test('progress resumes from elapsed time after holding, without skipping on release', () => {
  mount();
  advance(2000);
  expect(currentProgress()).toBe('40%');
  Renderer.act(() => {
    control('Next story item').props.onPressIn();
    control('Next story item').props.onLongPress();
  });
  advance(8000);
  expect(currentProgress()).toBe('40%');
  Renderer.act(() => {
    control('Next story item').props.onPressOut();
    control('Next story item').props.onPress();
  });
  advance(1000);
  expect(currentProgress()).toBe('60%');
  advance(2000);
  expect(mockMarkViewed).toHaveBeenLastCalledWith('b', 'b-0');
  expect(mockBack).not.toHaveBeenCalled();
});
test('viewed ranking changes do not switch authors while their items are playing', () => {
  mockStories = [story('a', 2), story('b')];
  mount();
  advance(5000);
  expect(mockMarkViewed).toHaveBeenLastCalledWith('a', 'a-1');
  advance(5000);
  expect(mockMarkViewed).toHaveBeenLastCalledWith('b', 'b-0');
  advance(5000);
  expect(mockBack).toHaveBeenCalledTimes(1);
});
test('swiping skips to the next account rather than its next segment', () => {
  mockStories = [story('a', 2), story('b')];
  mount();
  Renderer.act(() =>
    renderer.root
      .findByProps({ testID: 'story-pan' })
      .props.gesture.handler({ translationX: -100, translationY: 0 }),
  );
  expect(mockMarkViewed).toHaveBeenLastCalledWith('b', 'b-0');
});
test('video playback pauses while held and drives progress from actual playback', () => {
  mockStories = [story('a', 1, true), story('b')];
  mount();
  advance(6000);
  expect(mockMarkViewed).toHaveBeenLastCalledWith('a', 'a-0');
  Renderer.act(() =>
    renderer.root
      .findByProps({ testID: 'story-video' })
      .props.onPlaybackProgress(2, 10),
  );
  expect(currentProgress()).toBe('20%');
  Renderer.act(() => control('Next story item').props.onPressIn());
  expect(
    renderer.root.findByProps({ testID: 'story-video' }).props.paused,
  ).toBe(true);
});
test('private replies are sent to the story author’s real channel and failures retain the draft', async () => {
  mount();
  Renderer.act(() =>
    renderer.root.findByType(TextInput).props.onChangeText('Great moment'),
  );
  await Renderer.act(async () => control('Send story reply').props.onPress());
  expect(mockCreateChannel).toHaveBeenCalledWith(
    { id: 'a', type: 'personal' },
    { id: 'me', type: 'personal' },
  );
  expect(mockSendMessage).toHaveBeenCalledWith({
    text: 'Replied to your story: Great moment',
  });
  expect(mockNavigate).toHaveBeenCalledWith(
    'Thread',
    expect.objectContaining({ channelId: 'real-channel' }),
  );
  mockSendMessage.mockRejectedValueOnce(new Error('Offline'));
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  Renderer.act(() =>
    renderer.root.findByType(TextInput).props.onChangeText('Keep this draft'),
  );
  await Renderer.act(async () => control('Send story reply').props.onPress());
  expect(renderer.root.findByType(TextInput).props.value).toBe(
    'Keep this draft',
  );
});
test('reacting calls the content API with the active viewer identity', async () => {
  mount();
  await Renderer.act(async () => control('React to story').props.onPress());
  expect(mockLike).toHaveBeenCalledWith('a-0', true, {
    id: 'me',
    type: 'personal',
  });
  expect(control('Remove story reaction')).toBeDefined();
});

test('published caption uses the measured canvas and saved position, color, and text scale', () => {
  mockStories[0].items[0].storyStyle = {
    textX: 0.7,
    textY: 0.4,
    textColor: '#ffeeaa',
    textScale: 1.5,
    sticker: '✨',
  };
  mount();
  Renderer.act(() =>
    renderer.root
      .findByProps({ testID: 'story-media' })
      .props.onLayout({ nativeEvent: { layout: { width: 300, height: 600 } } }),
  );
  expect(
    renderer.root.findByProps({ testID: 'story-caption-position' }).props.style,
  ).toEqual(
    expect.objectContaining({ width: 240, left: 90, top: 240, padding: 8 }),
  );
  expect(
    renderer.root.findByProps({ testID: 'story-caption' }).props.style[1],
  ).toEqual(
    expect.objectContaining({ color: '#ffeeaa', fontSize: 42, lineHeight: 54 }),
  );
});

test('closing a viewer opened directly returns to the Flash tray when there is no back history', () => {
  mockCanGoBack.mockReturnValue(false);
  mount();
  Renderer.act(() => control('Close story').props.onPress());
  expect(mockBack).not.toHaveBeenCalled();
  expect(mockReset).toHaveBeenCalledWith({
    index: 0,
    routes: [{ name: 'Main', params: { screen: 'Flash' } }],
  });
  Renderer.act(() => control('Close story').props.onPress());
  expect(mockReset).toHaveBeenCalledTimes(1);
});
