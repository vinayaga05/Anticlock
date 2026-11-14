import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Image, Modal, Text } from 'react-native';
import { BusinessMediaViewer } from './BusinessMediaViewer';
jest.mock(
  '@/shared/components/AppIcon',
  () => require('@/test/componentMocks').appIconModule,
);
jest.mock('@/shared/components/PressableScale', () => ({
  PressableScale: ({ children, ...props }: any) => {
    const { Pressable } = require('react-native');
    return <Pressable {...props}>{children}</Pressable>;
  },
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('@/test/componentMocks').safeAreaModule,
);
const mockStop = jest.fn();
jest.mock('@/features/video/components/VideoPlayer', () => ({
  VideoPlayer: (props: any) => {
    const React = require('react');
    const { View } = require('react-native');
    React.useEffect(() => () => mockStop(props.uri), [props.uri]);
    return <View testID="gallery-video" {...props} />;
  },
}));
const items = [
  {
    id: 'image-1',
    kind: 'image' as const,
    url: 'https://example.test/image1.jpg',
  },
  {
    id: 'video-1',
    kind: 'video' as const,
    url: 'https://example.test/video.mp4',
  },
  {
    id: 'image-2',
    kind: 'image' as const,
    url: 'https://example.test/image2.jpg',
  },
];
function action(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  return renderer.root.findAll(
    node => node.props.accessibilityLabel === label && node.props.onPress,
  )[0];
}
function text(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAllByType(Text)
    .map(node => [node.props.children].flat().join(''))
    .join('\n');
}
function render(initialIndex: number | null = 0) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <BusinessMediaViewer
        items={items}
        initialIndex={initialIndex}
        onClose={jest.fn()}
      />,
    );
  });
  return renderer;
}
function close(renderer: ReactTestRenderer.ReactTestRenderer) {
  ReactTestRenderer.act(() => renderer.unmount());
}
beforeEach(() => mockStop.mockReset());
test('opens selected image and navigates within gallery boundaries', () => {
  const renderer = render();
  expect(renderer.root.findByType(Image).props.source.uri).toBe(items[0].url);
  expect(action(renderer, 'Previous gallery item').props.disabled).toBe(true);
  ReactTestRenderer.act(() =>
    action(renderer, 'Next gallery item').props.onPress(),
  );
  expect(
    renderer.root.findAll(node => node.props.testID === 'gallery-video'),
  ).not.toHaveLength(0);
  ReactTestRenderer.act(() =>
    action(renderer, 'Next gallery item').props.onPress(),
  );
  expect(renderer.root.findByType(Image).props.source.uri).toBe(items[2].url);
  expect(action(renderer, 'Next gallery item').props.disabled).toBe(true);
  expect(mockStop).toHaveBeenCalledWith(items[1].url);
  close(renderer);
});
test('hidden modal unmounts video and cannot continue audio while gallery is closed', () => {
  const renderer = render(1);
  expect(
    renderer.root.findAll(node => node.props.testID === 'gallery-video'),
  ).not.toHaveLength(0);
  ReactTestRenderer.act(() =>
    renderer.update(
      <BusinessMediaViewer
        items={items}
        initialIndex={null}
        onClose={jest.fn()}
      />,
    ),
  );
  expect(renderer.root.findAllByType(Modal)).toHaveLength(0);
  expect(
    renderer.root.findAll(node => node.props.testID === 'gallery-video'),
  ).toHaveLength(0);
  expect(mockStop).toHaveBeenCalledWith(items[1].url);
  close(renderer);
});
test('image loading failure shows recovery and retries selected source without blank gallery', () => {
  const renderer = render();
  ReactTestRenderer.act(() => renderer.root.findByType(Image).props.onError());
  expect(renderer.root.findAllByType(Image)).toHaveLength(0);
  expect(text(renderer)).toContain('This image could not load.');
  ReactTestRenderer.act(() =>
    action(renderer, 'Retry gallery image').props.onPress(),
  );
  expect(renderer.root.findByType(Image).props.source.uri).toBe(items[0].url);
  ReactTestRenderer.act(() => renderer.root.findByType(Image).props.onError());
  ReactTestRenderer.act(() =>
    renderer.update(
      <BusinessMediaViewer
        items={[{ ...items[0], url: 'https://example.test/replacement.jpg' }]}
        initialIndex={0}
        onClose={jest.fn()}
      />,
    ),
  );
  expect(renderer.root.findByType(Image).props.source.uri).toBe(
    'https://example.test/replacement.jpg',
  );
  expect(text(renderer)).not.toContain('could not load');
  close(renderer);
});
test('out of range index is clamped and empty/hidden galleries do not mount a Modal', () => {
  const renderer = render(99);
  expect(renderer.root.findByType(Image).props.source.uri).toBe(items[2].url);
  expect(text(renderer)).toContain('3 / 3');
  ReactTestRenderer.act(() =>
    renderer.update(
      <BusinessMediaViewer items={[]} initialIndex={0} onClose={jest.fn()} />,
    ),
  );
  expect(renderer.root.findAllByType(Modal)).toHaveLength(0);
  close(renderer);
});
