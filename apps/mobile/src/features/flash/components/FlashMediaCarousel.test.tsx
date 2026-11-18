import React from 'react';
import Renderer from 'react-test-renderer';
import { FlashMediaCarousel } from './FlashMediaCarousel';
import type { PostMedia } from '@/shared/data/flash/types';
import { feedMediaMemory } from '@/features/video/playback/feedMediaMemory';

jest.mock(
  '@/shared/hooks/useTheme',
  () => require('@/test/componentMocks').themeModule,
);
jest.mock(
  '@/shared/components/AppIcon',
  () => require('@/test/componentMocks').appIconModule,
);
jest.mock('@/features/video/components/VideoPlayer', () => ({
  VideoPlayer: (props: any) =>
    require('react').createElement('test-media-player', props),
}));
jest.mock('react-native/Libraries/Lists/FlatList', () => ({
  __esModule: true,
  default: (props: any) =>
    require('react').createElement(
      'test-media-list',
      props,
      props.data.map((item: any, index: number) =>
        require('react').createElement(
          require('react').Fragment,
          { key: item.id },
          props.renderItem({ item, index }),
        ),
      ),
    ),
}));
const video = (id: string): PostMedia => ({
  id,
  type: 'video',
  url: `https://cdn.example/${id}.mp4`,
});
let tree: Renderer.ReactTestRenderer;
const players = () => tree.root.findAllByType('test-media-player' as any);
const list = () => tree.root.findByType('test-media-list' as any);
const render = (postId: string, media: PostMedia[], playbackActive = true) =>
  Renderer.act(() => {
    tree = Renderer.create(
      <FlashMediaCarousel
        postId={postId}
        media={media}
        playbackActive={playbackActive}
      />,
    );
  });
const update = (postId: string, media: PostMedia[], playbackActive = true) =>
  Renderer.act(() => {
    tree.update(
      <FlashMediaCarousel
        postId={postId}
        media={media}
        playbackActive={playbackActive}
      />,
    );
  });
beforeEach(() => feedMediaMemory.clear());
afterEach(() => Renderer.act(() => tree?.unmount()));

it('never mounts a playable native surface for an inactive vertical post or still image', () => {
  render('post', [video('one')], false);
  expect(players()).toHaveLength(0);
  update('post', [video('one')]);
  expect(players()).toHaveLength(1);
  update('post', [
    { id: 'photo', type: 'image', url: 'https://cdn.example/photo.jpg' },
  ]);
  expect(players()).toHaveLength(0);
});

it('allows only one horizontal page and stops promptly while swiping or with no visible page', () => {
  const media = [video('one'), video('two')];
  render('post', media);
  expect(players()).toHaveLength(1);
  expect(players()[0].props.uri).toContain('one.mp4');
  Renderer.act(() => list().props.onScrollBeginDrag());
  expect(players()).toHaveLength(0);
  Renderer.act(() =>
    list().props.onViewableItemsChanged({ viewableItems: [] }),
  );
  Renderer.act(() => list().props.onMomentumScrollEnd());
  expect(players()).toHaveLength(0);
  Renderer.act(() =>
    list().props.onViewableItemsChanged({
      viewableItems: [{ item: media[1], index: 1, isViewable: true }],
    }),
  );
  expect(players()).toHaveLength(1);
  expect(players()[0].props.uri).toContain('two.mp4');
  update('post', media, false);
  expect(players()).toHaveLength(0);
});

it('restores per-post sound, manual pause and position after virtualization without changing siblings defaults', () => {
  const media = [video('one')];
  render('post-a', media);
  expect(players()[0].props.muted).toBe(false);
  expect(players()[0].props.paused).toBe(false);
  Renderer.act(() => {
    players()[0].props.onMutedChange(true);
    players()[0].props.onPausedChange(true);
    players()[0].props.onPlaybackProgress(12, 30);
  });
  update('post-a', media, false);
  expect(players()).toHaveLength(0);
  update('post-a', media);
  expect(players()[0].props.muted).toBe(true);
  expect(players()[0].props.paused).toBe(true);
  expect(players()[0].props.initialPositionSeconds).toBe(12);
  update('post-b', media);
  expect(players()[0].props.muted).toBe(false);
  expect(players()[0].props.paused).toBe(false);
  expect(players()[0].props.initialPositionSeconds).toBe(0);
});

it('uses saved position and mute intent when a refreshed URL represents the same logical media', () => {
  render('post', [video('one')]);
  Renderer.act(() => {
    players()[0].props.onMutedChange(true);
    players()[0].props.onPausedChange(true);
    players()[0].props.onPlaybackProgress(18, 30);
  });
  update('post', [
    { ...video('one'), url: 'https://cdn.example/one.mp4?signature=renewed' },
  ]);
  expect(players()).toHaveLength(1);
  expect(players()[0].props.muted).toBe(true);
  expect(players()[0].props.paused).toBe(true);
  expect(players()[0].props.initialPositionSeconds).toBe(18);
});

it('restarts from the beginning after leaving at the native repeat boundary', () => {
  const media = [video('one')];
  render('post', media);
  Renderer.act(() => {
    players()[0].props.onPlaybackProgress(29.9, 30);
    players()[0].props.onPlaybackComplete(30);
  });
  update('post', media, false);
  update('post', media);
  expect(players()[0].props.initialPositionSeconds).toBe(0);
});

it('clears an interrupted horizontal gesture when the feed becomes inactive', () => {
  const media = [video('one'), video('two')];
  render('post', media);
  Renderer.act(() => list().props.onScrollBeginDrag());
  expect(players()).toHaveLength(0);
  // A lifecycle interruption may prevent both native scroll-end events.
  update('post', media, false);
  update('post', media);
  expect(players()).toHaveLength(1);
  expect(players()[0].props.uri).toContain('one.mp4');
});

it('retains a posts sound preference across horizontal pages while keeping each medias pause and position', () => {
  const media = [video('one'), video('two')];
  render('post', media);
  Renderer.act(() => {
    players()[0].props.onMutedChange(true);
    players()[0].props.onPausedChange(true);
    players()[0].props.onPlaybackProgress(9, 30);
  });
  Renderer.act(() =>
    list().props.onViewableItemsChanged({
      viewableItems: [{ item: media[1], index: 1, isViewable: true }],
    }),
  );
  expect(players()).toHaveLength(1);
  expect(players()[0].props.muted).toBe(true);
  expect(players()[0].props.paused).toBe(false);
  expect(players()[0].props.initialPositionSeconds).toBe(0);
  Renderer.act(() => players()[0].props.onMutedChange(false));
  Renderer.act(() =>
    list().props.onViewableItemsChanged({
      viewableItems: [{ item: media[0], index: 0, isViewable: true }],
    }),
  );
  expect(players()[0].props.muted).toBe(false);
  expect(players()[0].props.paused).toBe(true);
  expect(players()[0].props.initialPositionSeconds).toBe(9);
});

it('ignores stale horizontal callbacks after media removal and renders audio with the shared sound controls', () => {
  const one = video('one');
  const audio: PostMedia = {
    id: 'audio',
    type: 'audio',
    url: 'https://cdn.example/audio.m4a',
  };
  render('post', [one, audio]);
  update('post', [
    audio,
    { id: 'photo', type: 'image', url: 'https://cdn.example/photo.jpg' },
  ]);
  Renderer.act(() =>
    list().props.onViewableItemsChanged({
      viewableItems: [{ item: one, index: 0, isViewable: true }],
    }),
  );
  expect(players()).toHaveLength(0);
  Renderer.act(() =>
    list().props.onViewableItemsChanged({
      viewableItems: [{ item: audio, index: 0, isViewable: true }],
    }),
  );
  expect(players()).toHaveLength(1);
  expect(players()[0].props.mediaKind).toBe('audio');
  expect(players()[0].props.muted).toBe(false);
});

it('waits for a fresh horizontal owner after media reorder and ignores callbacks from the old indexes', () => {
  const one = video('one');
  const two = video('two');
  render('post', [one, two]);
  expect(players()).toHaveLength(1);
  update('post', [two, one]);
  expect(players()).toHaveLength(0);
  Renderer.act(() =>
    list().props.onViewableItemsChanged({
      viewableItems: [{ item: one, index: 0, isViewable: true }],
    }),
  );
  expect(players()).toHaveLength(0);
  Renderer.act(() =>
    list().props.onViewableItemsChanged({
      viewableItems: [{ item: two, index: 0, isViewable: true }],
    }),
  );
  expect(players()).toHaveLength(1);
  expect(players()[0].props.uri).toContain('two.mp4');
});

it('promotes a paused warm player without replacing it or losing post preferences', () => {
  const media = [video('warm')];
  Renderer.act(() => {
    tree = Renderer.create(
      <FlashMediaCarousel postId="post" media={media} preparationEnabled />,
    );
  });
  const warm = players()[0];
  expect(warm.props.preloading).toBe(true);
  Renderer.act(() =>
    tree.update(
      <FlashMediaCarousel postId="post" media={media} playbackActive />,
    ),
  );
  expect(players()[0]).toBe(warm);
  expect(players()[0].props.preloading).toBe(false);
  update('post', media, false);
  expect(players()).toHaveLength(0);
});
