import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import {
  useProviderListPreview,
  visibleProviderPreviews,
} from './useProviderListPreview';
const providers: any[] = [
  { id: 'photo' },
  { id: 'a', introVideoUrl: 'a.mp4' },
  { id: 'b', introVideoUrl: 'b.mp4' },
];
const frames = new Map([
  ['photo', { y: 0, height: 100 }],
  ['a', { y: 100, height: 100 }],
  ['b', { y: 200, height: 100 }],
]);
test('selects only a sufficiently visible video row using the actual group/scroll geometry', () => {
  expect(visibleProviderPreviews(providers, frames, 300, 0, 450)).toEqual([]);
  expect(visibleProviderPreviews(providers, frames, 300, 0, 470)).toEqual([
    'a',
  ]);
  expect(visibleProviderPreviews(providers, frames, 300, 450, 200)).toEqual([
    'b',
  ]);
  expect(visibleProviderPreviews(providers, frames, 300, 650, 200)).toEqual([]);
});

test('visible rows take turns after the first frame and failed sources are skipped', () => {
  jest.useFakeTimers();
  let preview: ReturnType<typeof useProviderListPreview>;
  function Probe() {
    preview = useProviderListPreview(providers);
    return null;
  }
  let tree: Renderer.ReactTestRenderer;
  act(() => {
    tree = Renderer.create(<Probe />);
  });
  act(() => {
    preview!.onViewportLayout({
      nativeEvent: { layout: { height: 350 } },
    } as any);
    for (const [id, layout] of frames) {
      preview!.onRowLayout(id, { nativeEvent: { layout } } as any);
    }
    jest.advanceTimersByTime(120);
  });
  expect(preview!.activeId).toBe('a');
  act(() => jest.advanceTimersByTime(6000));
  expect(preview!.activeId).toBe('a');
  act(() => {
    preview!.onPreviewReady('a');
    jest.advanceTimersByTime(6120);
  });
  expect(preview!.activeId).toBe('b');
  act(() => {
    preview!.onPreviewFailed('b', 'b.mp4');
    jest.advanceTimersByTime(120);
  });
  expect(preview!.activeId).toBe('a');
  act(() => {
    preview!.onPreviewReady('a');
    jest.advanceTimersByTime(6120);
  });
  expect(preview!.activeId).toBe('a');
  act(() => tree!.unmount());
  jest.useRealTimers();
});
test('rapid scroll cancels pending starts and releases the previous preview promptly', () => {
  jest.useFakeTimers();
  let preview: ReturnType<typeof useProviderListPreview>;
  function Probe() {
    preview = useProviderListPreview(providers);
    return null;
  }
  let tree: Renderer.ReactTestRenderer;
  act(() => {
    tree = Renderer.create(<Probe />);
  });
  act(() => {
    preview!.onViewportLayout({
      nativeEvent: { layout: { height: 150 } },
    } as any);
    preview!.onGroupLayout({ nativeEvent: { layout: { y: 0 } } } as any);
    for (const [id, layout] of frames)
      preview!.onRowLayout(id, { nativeEvent: { layout } } as any);
    preview!.onScroll({
      nativeEvent: {
        contentOffset: { y: 100 },
        layoutMeasurement: { height: 150 },
      },
    } as any);
    jest.advanceTimersByTime(120);
  });
  expect(preview!.activeId).toBe('a');
  act(() =>
    preview!.onScroll({
      nativeEvent: {
        contentOffset: { y: 200 },
        layoutMeasurement: { height: 150 },
      },
    } as any),
  );
  expect(preview!.activeId).toBeNull();
  act(() => {
    preview!.onScroll({
      nativeEvent: {
        contentOffset: { y: 400 },
        layoutMeasurement: { height: 150 },
      },
    } as any);
    jest.advanceTimersByTime(120);
  });
  expect(preview!.activeId).toBeNull();
  act(() => tree!.unmount());
  jest.useRealTimers();
});
