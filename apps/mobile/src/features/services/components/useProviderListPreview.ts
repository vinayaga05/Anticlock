import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import type { MarketplaceProvider } from '@/shared/data/services';

type Frame = { y: number; height: number };
const PREVIEW_DURATION_MS = 6_000;

export function visibleProviderPreviews(
  providers: MarketplaceProvider[],
  frames: Map<string, Frame>,
  groupY: number,
  offset: number,
  height: number,
) {
  if (height <= 0) return [];
  return providers
    .filter(provider => {
      const frame = frames.get(provider.id);
      if (!provider.introVideoUrl || !frame || frame.height <= 0) return false;
      const top = groupY + frame.y;
      const visible = Math.max(
        0,
        Math.min(top + frame.height, offset + height) - Math.max(top, offset),
      );
      return visible / frame.height >= 0.7;
    })
    .map(provider => provider.id);
}

/** ScrollView rows share one muted preview. Only changing the active row renders;
 * geometry stays in refs and fast flings never create every row's player. */
export function useProviderListPreview(providers: MarketplaceProvider[]) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const geometry = useRef({
    groupY: 0,
    offset: 0,
    height: 0,
    frames: new Map<string, Frame>(),
  });
  const currentProviders = useRef(providers);
  currentProviders.current = providers;
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const candidate = useRef<string | null>(null);
  const ready = useRef(false);
  const failures = useRef(new Map<string, string>());
  const select = useCallback((next: string | null) => {
    if (startTimer.current) clearTimeout(startTimer.current);
    if (rotationTimer.current) clearTimeout(rotationTimer.current);
    startTimer.current = null;
    rotationTimer.current = null;
    candidate.current = next;
    ready.current = false;
    setActiveId(null);
    if (next) {
      startTimer.current = setTimeout(() => {
        startTimer.current = null;
        setActiveId(next);
      }, 120);
    }
  }, []);
  const update = useCallback(
    function update(advance = false) {
      const { frames, groupY, offset, height } = geometry.current;
      const visible = visibleProviderPreviews(
        currentProviders.current,
        frames,
        groupY,
        offset,
        height,
      ).filter(id => !failures.current.has(id));
      const current = candidate.current;
      const index = current == null ? -1 : visible.indexOf(current);
      const next =
        index < 0
          ? visible[0] ?? null
          : advance
          ? visible[(index + 1) % visible.length]
          : current;
      if (next !== current) {
        select(next);
        return;
      }
      if (visible.length < 2) {
        if (rotationTimer.current) clearTimeout(rotationTimer.current);
        rotationTimer.current = null;
      } else if (ready.current && !rotationTimer.current) {
        rotationTimer.current = setTimeout(() => {
          rotationTimer.current = null;
          update(true);
        }, PREVIEW_DURATION_MS);
      }
    },
    [select],
  );
  useEffect(() => {
    const sources = new Map(
      providers.map(provider => [provider.id, provider.introVideoUrl]),
    );
    for (const id of geometry.current.frames.keys())
      if (!sources.has(id)) geometry.current.frames.delete(id);
    for (const [id, url] of failures.current)
      if (sources.get(id) !== url) failures.current.delete(id);
    update();
  }, [providers, update]);
  useEffect(
    () => () => {
      if (startTimer.current) clearTimeout(startTimer.current);
      if (rotationTimer.current) clearTimeout(rotationTimer.current);
      startTimer.current = null;
      rotationTimer.current = null;
      candidate.current = null;
      ready.current = false;
    },
    [],
  );
  return {
    activeId,
    onPreviewReady: useCallback(
      (id: string) => {
        if (candidate.current !== id) return;
        ready.current = true;
        update();
      },
      [update],
    ),
    onPreviewFailed: useCallback(
      (id: string, url: string) => {
        if (
          candidate.current !== id ||
          !currentProviders.current.some(
            provider => provider.id === id && provider.introVideoUrl === url,
          )
        )
          return;
        failures.current.set(id, url);
        update();
      },
      [update],
    ),
    onScroll: useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        geometry.current.offset = event.nativeEvent.contentOffset.y;
        geometry.current.height = event.nativeEvent.layoutMeasurement.height;
        update();
      },
      [update],
    ),
    onViewportLayout: useCallback(
      (event: LayoutChangeEvent) => {
        geometry.current.height = event.nativeEvent.layout.height;
        update();
      },
      [update],
    ),
    onGroupLayout: useCallback(
      (event: LayoutChangeEvent) => {
        geometry.current.groupY = event.nativeEvent.layout.y;
        update();
      },
      [update],
    ),
    onRowLayout: useCallback(
      (id: string, event: LayoutChangeEvent) => {
        geometry.current.frames.set(id, event.nativeEvent.layout);
        update();
      },
      [update],
    ),
  };
}
