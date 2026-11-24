import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { AppState, Image } from 'react-native';
import { ProviderCardMedia } from './ProviderCardMedia';
let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}));
jest.mock('react-native-video', () => ({
  __esModule: true,
  default: 'native-video',
  ViewType: { TEXTURE: 1 },
}));
jest.mock(
  '@/shared/hooks/useTheme',
  () => require('@/test/componentMocks').themeModule,
);
jest.mock('@/shared/components/AppIcon', () => ({ AppIcon: () => null }));
let tree: Renderer.ReactTestRenderer;
let stateChanged: (state: string) => void;
const props = {
  imageUrl: 'https://cdn/cover.jpg',
  fallbackImageUrl: 'https://cdn/avatar.jpg',
  videoUrl: 'https://cdn/intro.mp4',
  active: true,
  name: 'Doctor',
};
const update = (overrides = {}) =>
  act(() => {
    if (!tree)
      tree = Renderer.create(<ProviderCardMedia {...props} {...overrides} />);
    else tree.update(<ProviderCardMedia {...props} {...overrides} />);
  });
const videos = () => tree.root.findAllByType('native-video' as any);
beforeEach(() => {
  jest.useFakeTimers();
  mockFocused = true;
  tree = undefined as any;
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active',
  });
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, handler) => {
      stateChanged = handler as any;
      return { remove: jest.fn() };
    });
});
afterEach(() => {
  act(() => tree?.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});
test('keeps the image until the first frame and uses a stable, muted looping source', () => {
  update();
  expect(tree.root.findByType(Image).props.source.uri).toBe(props.imageUrl);
  const video = videos()[0];
  expect(video.props).toMatchObject({
    muted: true,
    repeat: true,
    controls: false,
    playInBackground: false,
    playWhenInactive: false,
  });
  const source = video.props.source;
  act(() => video.props.onReadyForDisplay());
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  expect(videos()[0].props.source).toBe(source);
});
test('does not mount off-screen media and releases it on blur or background', () => {
  update({ active: false });
  expect(videos()).toHaveLength(0);
  update();
  expect(videos()).toHaveLength(1);
  mockFocused = false;
  update();
  expect(videos()).toHaveLength(0);
  mockFocused = true;
  update();
  expect(videos()).toHaveLength(1);
  act(() => stateChanged('background'));
  expect(videos()).toHaveLength(0);
  act(() => stateChanged('active'));
  expect(videos()).toHaveLength(1);
});
test('failed video falls back to the image; a failed cover falls back to the avatar', () => {
  update();
  act(() => videos()[0].props.onError());
  expect(videos()).toHaveLength(0);
  expect(tree.root.findByType(Image).props.source.uri).toBe(props.imageUrl);
  act(() => tree.root.findByType(Image).props.onError());
  expect(tree.root.findByType(Image).props.source.uri).toBe(
    props.fallbackImageUrl,
  );
});
test('slow video and providers without videos retain their image', () => {
  update();
  act(() => jest.advanceTimersByTime(10_000));
  expect(videos()).toHaveLength(0);
  expect(tree.root.findByType(Image).props.source.uri).toBe(props.imageUrl);
  update({ videoUrl: undefined });
  expect(videos()).toHaveLength(0);
});

test('late callbacks from a scrolled-away player cannot reveal or fail its replacement', () => {
  update();
  const old = videos()[0].props;
  update({ active: false });
  update();
  act(() => {
    old.onReadyForDisplay();
    old.onError();
  });
  expect(videos()).toHaveLength(1);
  expect(tree.root.findAllByType(Image)).toHaveLength(1);
  act(() => videos()[0].props.onReadyForDisplay());
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
});
