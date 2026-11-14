import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { chartSegments } from '../fitnessModel';
import { FitnessText, useFitnessColors } from './FitnessUI';

export function FitnessChart({
  values,
  labels,
  title,
  bars = false,
  unit = '',
}: {
  values: Array<number | null>;
  labels: string[];
  title: string;
  bars?: boolean;
  unit?: string;
}) {
  const c = useFitnessColors();
  const segments = chartSegments(values);
  const points = segments.join(' ');
  const valid = values.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  const max = Math.max(...valid, 1);
  const summary = values
    .map(
      (value, i) =>
        `${labels[i]}: ${value === null ? 'not recorded' : value + unit}`,
    )
    .join('; ');
  if (!valid.length)
    return (
      <FitnessText muted>
        No {title.toLowerCase()} recorded in this period.
      </FitnessText>
    );
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${title}. ${summary}`}
      style={{ gap: 7 }}
    >
      <FitnessText muted>
        Recorded range · {Math.round(Math.min(...valid) * 10) / 10}–
        {Math.round(Math.max(...valid) * 10) / 10}
        {unit}
      </FitnessText>
      <Svg viewBox="0 0 280 110" width="100%" height={125}>
        {[20, 55, 90].map(y => (
          <Line
            key={y}
            x1={12}
            x2={268}
            y1={y}
            y2={y}
            stroke={c.line}
            strokeWidth={1}
          />
        ))}
        {bars ? (
          values.map(
            (v, i) =>
              v !== null &&
              Number.isFinite(v) && (
                <Rect
                  key={i}
                  x={12 + (i * 256) / values.length}
                  y={98 - (v / max) * 82}
                  width={Math.max(2, 240 / values.length - 3)}
                  height={Math.max(1, (v / max) * 82)}
                  rx={3}
                  fill={c.accent}
                />
              ),
          )
        ) : (
          <>
            {segments.map((segment, index) => (
              <Polyline
                key={index}
                points={segment}
                stroke={c.accent}
                strokeWidth={2.5}
                fill="none"
              />
            ))}
            {points
              .split(' ')
              .filter(Boolean)
              .map((point, i) => {
                const [cx, cy] = point.split(',');
                return (
                  <Circle key={i} cx={cx} cy={cy} r={3.5} fill={c.accent} />
                );
              })}
          </>
        )}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <FitnessText muted>{labels[0]}</FitnessText>
        <FitnessText muted>{labels[labels.length - 1]}</FitnessText>
      </View>
    </View>
  );
}
