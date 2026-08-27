import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

type Props = {
  variant?: 'empty' | 'confirm' | 'search' | 'hero';
  accent?: string;
  width?: number;
  height?: number;
};

/** Simple colorful SVG illustrations — not emoji, not third-party art. */
export function SoftIllustration({
  variant = 'empty',
  accent = '#14B8A6',
  width = 160,
  height = 120,
}: Props) {
  if (variant === 'confirm') {
    return (
      <Svg width={width} height={height} viewBox="0 0 160 120">
        <Circle cx="80" cy="58" r="36" fill={`${accent}33`} />
        <Circle cx="80" cy="58" r="26" fill={accent} />
        <Path
          d="M66 58 L76 68 L96 48"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Circle cx="36" cy="30" r="6" fill="#F472B6" opacity={0.7} />
        <Circle cx="128" cy="28" r="5" fill="#FBBF24" opacity={0.8} />
        <Circle cx="132" cy="88" r="7" fill="#38BDF8" opacity={0.6} />
      </Svg>
    );
  }

  if (variant === 'search') {
    return (
      <Svg width={width} height={height} viewBox="0 0 160 120">
        <Ellipse cx="80" cy="96" rx="48" ry="8" fill={`${accent}22`} />
        <Circle cx="72" cy="52" r="28" fill={`${accent}28`} stroke={accent} strokeWidth="3" />
        <Path
          d="M92 74 L112 94"
          stroke={accent}
          strokeWidth="6"
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (variant === 'hero') {
    return (
      <Svg width={width} height={height} viewBox="0 0 200 120">
        <Rect x="20" y="30" width="70" height="70" rx="20" fill={`${accent}30`} />
        <Rect x="100" y="18" width="60" height="50" rx="16" fill="#A78BFA33" />
        <Rect x="110" y="72" width="70" height="36" rx="14" fill="#FBBF2433" />
        <Circle cx="55" cy="65" r="16" fill={accent} opacity={0.85} />
      </Svg>
    );
  }

  return (
    <View>
      <Svg width={width} height={height} viewBox="0 0 160 120">
        <Ellipse cx="80" cy="100" rx="50" ry="10" fill={`${accent}18`} />
        <Rect x="40" y="28" width="80" height="56" rx="18" fill={`${accent}22`} />
        <Circle cx="68" cy="54" r="12" fill={accent} opacity={0.8} />
        <Rect x="86" y="46" width="24" height="8" rx="4" fill={accent} opacity={0.5} />
        <Rect x="86" y="60" width="18" height="8" rx="4" fill={accent} opacity={0.35} />
      </Svg>
    </View>
  );
}
