import React, { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  MAX_CLIP_DURATION_MS,
  MIN_CLIP_DURATION_MS,
  formatSeconds,
} from './clipEditModel';

type Props = {
  totalMs: number;
  trimStartMs: number;
  trimEndMs: number;
  thumbnails: string[];
  /** Segment boundaries on the timeline (excluding 0). */
  boundariesMs: number[];
  /** Playhead on the full timeline, or null to hide it. */
  playheadMs: number | null;
  onTrimChange: (startMs: number, endMs: number, anchor: 'start' | 'end') => void;
  onScrubbing?: (active: boolean) => void;
};

const HANDLE = 16;
const HEIGHT = 52;
const RADIUS = 10;

/**
 * Thumbnail strip with draggable trim handles. The handles move on the UI
 * thread and report the final window once the drag ends.
 */
export function TrimTimeline({
  totalMs,
  trimStartMs,
  trimEndMs,
  thumbnails,
  boundariesMs,
  playheadMs,
  onTrimChange,
  onScrubbing,
}: Props) {
  const [width, setWidth] = useState(0);
  const stripWidth = useSharedValue(0);
  const total = useSharedValue(Math.max(1, totalMs));
  const left = useSharedValue(0);
  const right = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const dragging = useSharedValue(false);
  const [liveLabel, setLiveLabel] = useState<string | null>(null);

  const usable = Math.max(1, width - HANDLE * 2);

  useEffect(() => {
    total.value = Math.max(1, totalMs);
    if (dragging.value || width <= 0) return;
    left.value = (trimStartMs / Math.max(1, totalMs)) * usable;
    right.value = (trimEndMs / Math.max(1, totalMs)) * usable;
  }, [dragging, left, right, total, totalMs, trimEndMs, trimStartMs, usable, width]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth(next);
    stripWidth.value = Math.max(1, next - HANDLE * 2);
  };

  const commit = (anchor: 'start' | 'end', l: number, r: number, w: number, t: number) => {
    setLiveLabel(null);
    onScrubbing?.(false);
    onTrimChange((l / w) * t, (r / w) * t, anchor);
  };
  const live = (l: number, r: number, w: number, t: number) => {
    setLiveLabel(formatSeconds(((r - l) / w) * t));
  };
  const begin = () => onScrubbing?.(true);

  const makePan = (edge: 'start' | 'end') =>
    Gesture.Pan()
      .hitSlop({ horizontal: 14, vertical: 10 })
      .onBegin(() => {
        dragging.value = true;
        dragStart.value = edge === 'start' ? left.value : right.value;
        runOnJS(begin)();
      })
      .onUpdate(e => {
        const w = stripWidth.value;
        const t = total.value;
        const minPx = (Math.min(MIN_CLIP_DURATION_MS, t) / t) * w;
        const maxPx = (MAX_CLIP_DURATION_MS / t) * w;
        const next = dragStart.value + e.translationX;
        if (edge === 'start') {
          left.value = Math.min(
            right.value - minPx,
            Math.max(0, right.value - maxPx, next),
          );
        } else {
          right.value = Math.max(
            left.value + minPx,
            Math.min(w, left.value + maxPx, next),
          );
        }
        runOnJS(live)(left.value, right.value, w, t);
      })
      .onEnd(() => {
        runOnJS(commit)(edge, left.value, right.value, stripWidth.value, total.value);
      })
      .onFinalize(() => {
        dragging.value = false;
      });

  const startPan = makePan('start');
  const endPan = makePan('end');

  const leftHandleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: left.value }],
  }));
  const rightHandleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: right.value + HANDLE }],
  }));
  const frameStyle = useAnimatedStyle(() => ({
    left: left.value + HANDLE,
    width: Math.max(0, right.value - left.value),
  }));
  const dimLeftStyle = useAnimatedStyle(() => ({ width: left.value }));
  const dimRightStyle = useAnimatedStyle(() => ({
    left: right.value + HANDLE,
  }));

  const selectedMs = Math.max(0, trimEndMs - trimStartMs);
  const playheadLeft =
    playheadMs !== null && totalMs > 0
      ? HANDLE + (Math.min(Math.max(playheadMs, 0), totalMs) / totalMs) * usable
      : null;

  return (
    <View style={styles.root}>
      <View style={styles.labelRow} pointerEvents="none">
        {liveLabel ? (
          <View style={styles.liveChip}>
            <Text style={styles.liveText}>{liveLabel}</Text>
          </View>
        ) : null}
      </View>
      <View
        style={styles.strip}
        onLayout={onLayout}
        accessibilityLabel={`Trim window ${formatSeconds(selectedMs)}`}
      >
        <View style={styles.thumbs}>
          {thumbnails.length > 0
            ? thumbnails.map((uri, index) => (
                <Image key={`${uri}-${index}`} source={{ uri }} style={styles.thumb} />
              ))
            : null}
        </View>
        {width > 0
          ? boundariesMs.map(ms => (
              <View
                key={`b-${ms}`}
                pointerEvents="none"
                style={[
                  styles.boundary,
                  { left: HANDLE + (ms / Math.max(1, totalMs)) * usable - 1 },
                ]}
              />
            ))
          : null}
        {width > 0 ? (
          <>
            <Animated.View pointerEvents="none" style={[styles.dim, styles.dimLeft, dimLeftStyle]} />
            <Animated.View pointerEvents="none" style={[styles.dim, styles.dimRight, dimRightStyle]} />
            <Animated.View pointerEvents="none" style={[styles.frame, frameStyle]} />
            {playheadLeft !== null ? (
              <View pointerEvents="none" style={[styles.playhead, { left: playheadLeft - 1.5 }]} />
            ) : null}
            <GestureDetector gesture={startPan}>
              <Animated.View
                style={[styles.handle, styles.handleLeft, leftHandleStyle]}
                accessibilityLabel="Trim start handle"
              >
                <View style={styles.grip} />
              </Animated.View>
            </GestureDetector>
            <GestureDetector gesture={endPan}>
              <Animated.View
                style={[styles.handle, styles.handleRight, rightHandleStyle]}
                accessibilityLabel="Trim end handle"
              >
                <View style={styles.grip} />
              </Animated.View>
            </GestureDetector>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  labelRow: { height: 20, alignItems: 'center', justifyContent: 'center' },
  liveChip: {
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
  },
  liveText: { color: '#111', fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  strip: { height: HEIGHT, justifyContent: 'center' },
  thumbs: {
    position: 'absolute',
    left: HANDLE,
    right: HANDLE,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  thumb: { flex: 1, height: '100%' },
  boundary: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    width: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  dim: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  dimLeft: { left: HANDLE },
  dimRight: { right: HANDLE },
  frame: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderColor: '#fff',
  },
  playhead: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    width: 3,
    borderRadius: 2,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: HANDLE,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleLeft: { borderTopLeftRadius: RADIUS, borderBottomLeftRadius: RADIUS },
  handleRight: { borderTopRightRadius: RADIUS, borderBottomRightRadius: RADIUS },
  grip: { width: 3, height: 16, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.55)' },
});
