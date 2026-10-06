import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type Props = {
  size: number;
  strokeWidth: number;
  /** Already recorded (0..1). */
  recorded: number;
  /** Including the take in progress (0..1). */
  live: number;
  /** Segment boundaries (0..1) drawn as small gaps. */
  marks: number[];
};

/** Circular progress around the capture button (recorded + live take). */
export function RecordProgressRing({ size, strokeWidth, recorded, live, marks }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (value: number) => circumference * (1 - Math.min(1, Math.max(0, value)));
  const center = size / 2;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
      <Svg width={size} height={size} style={styles.rotate}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(255,255,255,0.28)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#ff4d5e"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dash(live)}
          strokeLinecap="butt"
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#fff"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dash(recorded)}
          strokeLinecap="butt"
          fill="none"
        />
        {marks.map(mark => (
          <Circle
            key={mark}
            cx={center}
            cy={center}
            r={radius}
            stroke="#050505"
            strokeWidth={strokeWidth + 1}
            strokeDasharray={`2 ${circumference}`}
            strokeDashoffset={-circumference * mark + 1}
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  rotate: { transform: [{ rotate: '-90deg' }] },
});
