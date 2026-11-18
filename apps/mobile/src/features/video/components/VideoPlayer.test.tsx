import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AppState } from 'react-native';
import { VideoPlayer } from './VideoPlayer';

let mockFocused = true;
const mockSeek = jest.fn();
const mockPause = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}));
jest.mock(
  '@/shared/components/AppIcon',
  () => require('@/test/componentMocks').appIconModule,
);
jest.mock('react-native-video', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    ViewType: { TEXTURE: 0 },
    default: ReactModule.forwardRef((props: object, ref: unknown) => {
      ReactModule.useImperativeHandle(ref, () => ({
        seek: mockSeek,
        pause: mockPause,
      }));
      return <View testID="native-video" {...props} />;
    }),
  };
});

let renderer: ReactTestRenderer.ReactTestRenderer;
let appStateChanged: (state: string) => void;
const removed = jest.fn();
const video = () => renderer.root.findByProps({ testID: 'native-video' });
const playback = () =>
  renderer.root.findByProps({ testID: 'video-playback-toggle' });
const mute = () => renderer.root.findByProps({ testID: 'media-mute-toggle' });
const render = (element: React.ReactElement) =>
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(element);
  });
const update = (element: React.ReactElement) =>
  ReactTestRenderer.act(() => renderer.update(element));
const pressMute = () =>
  ReactTestRenderer.act(() =>
    mute().props.onPress({ stopPropagation: jest.fn() }),
  );

beforeEach(() => {
  jest.useFakeTimers();
  mockFocused = true;
  AppState.currentState = 'active';
  mockSeek.mockReset();
  mockPause.mockReset();
  removed.mockReset();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event: any, listener: any) => {
      appStateChanged = listener;
      return { remove: removed };
    });
});
afterEach(() => {
  ReactTestRenderer.act(() => renderer?.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('pauses and resumes on surface press without hiding the speaker during playback', () => {
  render(<VideoPlayer uri="https://cdn.example.com/clip.mp4" muted={false} />);
  expect(video().props.paused).toBe(false);
  expect(playback().props.accessibilityLabel).toBe('Pause video');
  expect(mute().props.accessibilityLabel).toBe('Mute audio');
  ReactTestRenderer.act(() => playback().props.onPress());
  expect(video().props.paused).toBe(true);
  expect(playback().props.accessibilityLabel).toBe('Play video');
  ReactTestRenderer.act(() => playback().props.onPress());
  expect(video().props.paused).toBe(false);
});

it('speaker matches actual native mute during buffering and toggles sound without reloading', () => {
  render(<VideoPlayer uri="https://cdn.example.com/clip.mp4" muted={false} />);
  const source = video().props.source;
  expect(video().props.muted).toBe(false);
  ReactTestRenderer.act(() => video().props.onBuffer({ isBuffering: true }));
  pressMute();
  expect(video().props.muted).toBe(true);
  expect(mute().props.accessibilityLabel).toBe('Unmute audio');
  expect(video().props.source).toBe(source);
  pressMute();
  expect(video().props.muted).toBe(false);
  expect(mute().props.accessibilityLabel).toBe('Mute audio');
});

it('keeps an uncontrolled source mute choice across visibility changes and resets for a new source', () => {
  render(<VideoPlayer uri="https://cdn.example.com/one.mp4" muted={false} />);
  pressMute();
  update(
    <VideoPlayer uri="https://cdn.example.com/one.mp4" muted={false} paused />,
  );
  expect(video().props.muted).toBe(true);
  update(<VideoPlayer uri="https://cdn.example.com/one.mp4" muted={false} />);
  expect(video().props.muted).toBe(true);
  update(<VideoPlayer uri="https://cdn.example.com/two.mp4" muted={false} />);
  expect(video().props.muted).toBe(false);
});

it('supports feed-owned mute and user pause preferences across remounts', () => {
  const onMutedChange = jest.fn();
  const onPausedChange = jest.fn();
  const player = (muted: boolean, paused: boolean) => (
    <VideoPlayer
      uri="https://cdn.example.com/clip.mp4"
      muted={muted}
      paused={paused}
      onMutedChange={onMutedChange}
      onPausedChange={onPausedChange}
    />
  );
  render(player(false, false));
  pressMute();
  expect(onMutedChange).toHaveBeenCalledWith(true);
  expect(video().props.muted).toBe(false);
  update(player(true, false));
  expect(video().props.muted).toBe(true);
  expect(mute().props.accessibilityLabel).toBe('Unmute audio');
  ReactTestRenderer.act(() => playback().props.onPress());
  expect(onPausedChange).toHaveBeenCalledWith(true);
  update(player(true, true));
  expect(video().props.paused).toBe(true);
});

it('prepares adjacent clips silently without sound controls or poster removal', () => {
  render(
    <VideoPlayer
      uri="https://cdn.example.com/next/manifest/video.m3u8"
      poster="https://cdn.example.com/poster.jpg"
      muted={false}
      preloading
    />,
  );
  expect(video().props.paused).toBe(true);
  expect(video().props.muted).toBe(true);
  expect(video().props.source.type).toBe('m3u8');
  expect(video().props.preferredForwardBufferDuration).toBe(3);
  expect(
    renderer.root.findAllByProps({ testID: 'media-mute-toggle' }),
  ).toHaveLength(0);
  expect(
    renderer.root.findByProps({ testID: 'video-poster' }).props.source.uri,
  ).toContain('poster.jpg');
});

it('pauses on screen blur, app background and audio focus loss; user pause survives interruptions', () => {
  const player = (
    <VideoPlayer uri="https://cdn.example.com/clip.mp4" muted={false} />
  );
  render(player);
  mockFocused = false;
  update(<VideoPlayer uri="https://cdn.example.com/clip.mp4" muted={false} />);
  expect(video().props.paused).toBe(true);
  mockFocused = true;
  update(<VideoPlayer uri="https://cdn.example.com/clip.mp4" muted={false} />);
  expect(video().props.paused).toBe(false);
  ReactTestRenderer.act(() => appStateChanged('background'));
  expect(video().props.paused).toBe(true);
  expect(mockPause).toHaveBeenCalled();
  ReactTestRenderer.act(() => appStateChanged('active'));
  expect(video().props.paused).toBe(false);
  ReactTestRenderer.act(() =>
    video().props.onAudioFocusChanged({ hasAudioFocus: false }),
  );
  expect(video().props.paused).toBe(true);
  ReactTestRenderer.act(() =>
    video().props.onAudioFocusChanged({ hasAudioFocus: true }),
  );
  expect(video().props.paused).toBe(false);
  ReactTestRenderer.act(() => playback().props.onPress());
  ReactTestRenderer.act(() =>
    video().props.onAudioFocusChanged({ hasAudioFocus: false }),
  );
  ReactTestRenderer.act(() =>
    video().props.onAudioFocusChanged({ hasAudioFocus: true }),
  );
  expect(video().props.paused).toBe(true);
});

it('allows explicit Play to recover after permanent Android focus loss', () => {
  render(<VideoPlayer uri="https://cdn.example.com/clip.mp4" muted={false} />);
  ReactTestRenderer.act(() =>
    video().props.onAudioFocusChanged({ hasAudioFocus: false }),
  );
  expect(video().props.paused).toBe(true);
  ReactTestRenderer.act(() => playback().props.onPress());
  expect(video().props.paused).toBe(false);
});

it('pauses when headphones disconnect and unsubscribes lifecycle listeners on unmount', () => {
  render(<VideoPlayer uri="https://cdn.example.com/clip.mp4" muted={false} />);
  ReactTestRenderer.act(() => video().props.onAudioBecomingNoisy());
  expect(video().props.paused).toBe(true);
  expect(video().props.playInBackground).toBe(false);
  expect(video().props.playWhenInactive).toBe(false);
  ReactTestRenderer.act(() => renderer.unmount());
  expect(removed).toHaveBeenCalledTimes(1);
});

it('restores a saved position once, without seeking again on mute or pause updates', () => {
  render(
    <VideoPlayer
      uri="https://cdn.example.com/clip.mp4"
      initialPositionSeconds={12}
    />,
  );
  ReactTestRenderer.act(() => video().props.onLoad({ duration: 30 }));
  expect(mockSeek).toHaveBeenCalledWith(12);
  pressMute();
  update(
    <VideoPlayer
      uri="https://cdn.example.com/clip.mp4"
      initialPositionSeconds={14}
      paused
    />,
  );
  ReactTestRenderer.act(() => video().props.onLoad({ duration: 30 }));
  expect(mockSeek).toHaveBeenCalledTimes(1);
});

it('restores refreshed sources while preserving parent-owned mute and manual pause intent', () => {
  const player = (signature: string, position: number) => (
    <VideoPlayer
      uri={`https://cdn.example.com/clip.mp4?signature=${signature}`}
      initialPositionSeconds={position}
      muted
      paused
      onMutedChange={jest.fn()}
      onPausedChange={jest.fn()}
    />
  );
  render(player('old', 8));
  ReactTestRenderer.act(() => video().props.onLoad({ duration: 30 }));
  expect(mockSeek).toHaveBeenLastCalledWith(8);
  update(player('renewed', 18));
  ReactTestRenderer.act(() => video().props.onLoad({ duration: 30 }));
  expect(mockSeek).toHaveBeenLastCalledWith(18);
  expect(mockSeek).toHaveBeenCalledTimes(2);
  expect(video().props.muted).toBe(true);
  expect(video().props.paused).toBe(true);
  expect(mute().props.accessibilityLabel).toBe('Unmute audio');
  expect(playback().props.accessibilityLabel).toBe('Play video');
});

it('renders audio-only media with the same sound and pause controls and lets native infer local audio format', () => {
  render(
    <VideoPlayer
      uri="file:///voice-note.m4a"
      mediaKind="audio"
      muted={false}
    />,
  );
  expect(video().props.source.type).toBeUndefined();
  expect(playback().props.accessibilityLabel).toBe('Pause audio');
  ReactTestRenderer.act(() => video().props.onLoad({ duration: 20 }));
  expect(mute().props.accessibilityLabel).toBe('Mute audio');
  pressMute();
  expect(video().props.muted).toBe(true);
  expect(mute().props.accessibilityLabel).toBe('Unmute audio');
});

it('keeps errors silent and ignores late progress/end events from an inactive source', () => {
  const progress = jest.fn();
  const complete = jest.fn();
  render(
    <VideoPlayer
      uri="https://cdn.example.com/clip.mp4"
      paused
      onPlaybackProgress={progress}
      onPlaybackComplete={complete}
    />,
  );
  ReactTestRenderer.act(() => video().props.onLoad({ duration: 30 }));
  ReactTestRenderer.act(() => video().props.onProgress({ currentTime: 2 }));
  ReactTestRenderer.act(() => video().props.onEnd());
  expect(progress).not.toHaveBeenCalled();
  expect(complete).not.toHaveBeenCalled();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  ReactTestRenderer.act(() =>
    video().props.onError({ error: { errorString: 'Decode failed' } }),
  );
  expect(renderer.root.findAllByProps({ testID: 'native-video' })).toHaveLength(
    0,
  );
  expect(
    renderer.root.findAllByProps({ testID: 'media-mute-toggle' }),
  ).toHaveLength(0);
});

it('retains its poster, delays the spinner, and offers retry after a startup timeout', () => {
  render(
    <VideoPlayer
      uri="https://cdn.example/slow.mp4"
      poster="https://cdn.example/poster.jpg"
      muted={false}
    />,
  );
  expect(renderer.root.findByProps({ testID: 'video-poster' })).toBeTruthy();
  ReactTestRenderer.act(() => jest.advanceTimersByTime(500));
  expect(
    renderer.root.findAllByType(require('react-native').ActivityIndicator),
  ).toHaveLength(0);
  ReactTestRenderer.act(() => jest.advanceTimersByTime(20_000));
  expect(renderer.root.findByProps({ testID: 'video-poster' })).toBeTruthy();
  expect(renderer.root.findAllByProps({ testID: 'native-video' })).toHaveLength(
    0,
  );
  ReactTestRenderer.act(() =>
    renderer.root.findByProps({ testID: 'media-retry' }).props.onPress(),
  );
  expect(video().props.paused).toBe(false);
  ReactTestRenderer.act(() => video().props.onReadyForDisplay());
  ReactTestRenderer.act(() => jest.advanceTimersByTime(21_000));
  expect(renderer.root.findAllByProps({ testID: 'media-retry' })).toHaveLength(
    0,
  );
});
