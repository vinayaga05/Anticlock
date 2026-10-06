import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

type Props = {
  /** 0..1 */
  value: number;
  onChange: (value: number) => void;
  /** Called once when the gesture ends (use for expensive work). */
  onChangeEnd?: (value: number) => void;
  label: string;
  valueLabel?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  step?: number;
};

const THUMB = 22;

/** Small horizontal slider (RNGH + Reanimated, runs on the UI thread). */
export function EditorSlider({
  value,
  onChange,
  onChangeEnd,
  label,
  valueLabel,
  accessibilityLabel,
  disabled,
  step = 0.05,
}: Props) {
  const [width, setWidth] = useState(0);
  const position = useSharedValue(value);
  const trackWidth = useSharedValue(0);
  const dragging = useSharedValue(false);

  useEffect(() => {
    if (!dragging.value) position.value = value;
  }, [dragging, position, value]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth(next);
    trackWidth.value = next;
  };

  const update = (x: number, end: boolean) => {
    'worklet';
    const usable = Math.max(1, trackWidth.value - THUMB);
    const next = Math.min(1, Math.max(0, (x - THUMB / 2) / usable));
    position.value = next;
    runOnJS(onChange)(next);
    if (end && onChangeEnd) runOnJS(onChangeEnd)(next);
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-4, 4])
    .failOffsetY([-14, 14])
    .onBegin(e => {
      dragging.value = true;
      update(e.x, false);
    })
    .onUpdate(e => update(e.x, false))
    .onEnd(e => update(e.x, true))
    .onFinalize(() => {
      dragging.value = false;
    });
  const tap = Gesture.Tap()
    .enabled(!disabled)
    .onEnd(e => update(e.x, true));

  const fillStyle = useAnimatedStyle(() => ({
    width: position.value * Math.max(0, trackWidth.value - THUMB),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: position.value * Math.max(0, trackWidth.value - THUMB) },
    ],
  }));

  const adjust = (delta: number) => {
    const next = Math.min(1, Math.max(0, value + delta));
    onChange(next);
    onChangeEnd?.(next);
  };

  return (
    <View style={[styles.root, disabled && styles.disabled]}>
      <View style={styles.labels}>
        <Text style={styles.label}>{label}</Text>
        {valueLabel ? <Text style={styles.value}>{valueLabel}</Text> : null}
      </View>
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <View
          style={styles.hit}
          onLayout={onLayout}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{ text: valueLabel ?? `${Math.round(value * 100)}%` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={event =>
            adjust(event.nativeEvent.actionName === 'increment' ? step : -step)
          }
        >
          <View style={styles.track} />
          {width > 0 ? (
            <>
              <Animated.View style={[styles.fill, fillStyle]} />
              <Animated.View style={[styles.thumb, thumbStyle]} />
            </>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  disabled: { opacity: 0.45 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: '#e6e6e8', fontSize: 13, fontWeight: '700' },
  value: { color: '#a4a4a8', fontSize: 12, fontVariant: ['tabular-nums'] },
  hit: { height: 32, justifyContent: 'center' },
  track: {
    position: 'absolute',
    left: THUMB / 2,
    right: THUMB / 2,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3a3a40',
  },
  fill: {
    position: 'absolute',
    left: THUMB / 2,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
