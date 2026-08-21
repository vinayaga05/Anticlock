import React from 'react';
import Svg, { Circle, Path, Rect, Polyline } from 'react-native-svg';

type IconProps = {
  size?: number;
  color?: string;
  filled?: boolean;
};

export function HomeIcon({ size = 26, color = '#000', filled }: IconProps) {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d="M12 2.1 1 10.5h2.5V21h7V14h3v7h7V10.5H23L12 2.1z" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5z" />
    </Svg>
  );
}

export function ReelsIcon({ size = 26, color = '#000', filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={filled ? 2.2 : 1.8}>
      <Rect x={3} y={3} width={18} height={18} rx={5} fill={filled ? color : 'none'} />
      <Circle cx={12} cy={12} r={filled ? 5 : 4} fill={filled ? '#fff' : color} stroke="none" />
    </Svg>
  );
}

export function PlusIcon({ size = 26, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </Svg>
  );
}

export function CrossIcon({ size = 26, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M12 4v16M4 12h16" strokeLinecap="round" />
      <Path d="M8 8l8 8M16 8l-8 8" strokeLinecap="round" opacity={0.15} />
    </Svg>
  );
}

export function HeartBeatIcon({ size = 26, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Polyline points="3,12 7,12 9,6 12,18 15,10 17,12 21,12" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ShopIcon({ size = 26, color = '#000', filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={1.8}>
      <Path d="M3 9l1.5-4h15L21 9" />
      <Path d="M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9z" />
      <Path d="M9 13h6" strokeLinecap="round" />
    </Svg>
  );
}

export function SearchIcon({ size = 22, color = '#000', filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={filled ? 2.4 : 1.8}>
      <Circle cx={11} cy={11} r={7} />
      <Path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </Svg>
  );
}

export function HeartIcon({ size = 26, color = '#000', filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={1.8}>
      <Path d="M12 20.5s-7.5-4.6-9.2-9.1C1.4 8.3 3 5.5 6.1 5.5c1.9 0 3.3 1.1 3.9 2.1.6-1 2-2.1 3.9-2.1 3.1 0 4.7 2.8 3.3 5.9-1.7 4.5-9.2 9.1-9.2 9.1z" />
    </Svg>
  );
}

export function CommentIcon({ size = 26, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path d="M20 12.5a7.5 7.5 0 0 1-7.5 7.5H7l-4 3V12.5A7.5 7.5 0 0 1 20 12.5z" />
    </Svg>
  );
}

export function ShareIcon({ size = 26, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path d="M22 3 10.5 14.5" strokeLinecap="round" />
      <Path d="M22 3 15 21l-4.5-6.5L4 10l18-7z" strokeLinejoin="round" />
    </Svg>
  );
}

export function BookmarkIcon({ size = 26, color = '#000', filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={1.8}>
      <Path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1z" />
    </Svg>
  );
}

export function SettingsIcon({ size = 22, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Circle cx={12} cy={12} r={3} />
      <Path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" strokeLinecap="round" />
    </Svg>
  );
}

export function ProfileIcon({ size = 26, color = '#000', filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={1.8}>
      <Circle cx={12} cy={8} r={3.5} />
      <Path d="M5 19.5c1.5-3.5 4-5 7-5s5.5 1.5 7 5" strokeLinecap="round" />
    </Svg>
  );
}

export function BackIcon({ size = 22, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function LocationIcon({ size = 18, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z" />
      <Circle cx={12} cy={10} r={2.5} />
    </Svg>
  );
}

export function CartIcon({ size = 26, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path d="M3 5h2l2.2 11h11.3L21 8H7" strokeLinejoin="round" />
      <Circle cx={10} cy={20} r={1.4} fill={color} stroke="none" />
      <Circle cx={17} cy={20} r={1.4} fill={color} stroke="none" />
    </Svg>
  );
}

export function BookIcon({ size = 26, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5z" />
      <Path d="M8 7h8M8 11h8" strokeLinecap="round" />
    </Svg>
  );
}

export function CallIcon({ size = 18, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path d="M6.5 3.5 9 6l-2 3c1.5 3 4 5.5 7 7l3-2 2.5 2.5c-.8 2.2-3.5 3.8-6 3.5C7.5 19.2 4 12.5 4.5 6.5c.2-1.8 1.8-2.8 2-3z" strokeLinejoin="round" />
    </Svg>
  );
}

export function ThumbDownIcon({ size = 26, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path d="M10 15v5a2 2 0 0 0 2 2l5-11V3H7.5a2 2 0 0 0-2 1.7L4 12.5A2 2 0 0 0 6 15h4z" />
      <Path d="M17 3h2.5A1.5 1.5 0 0 1 21 4.5v6A1.5 1.5 0 0 1 19.5 12H17" />
    </Svg>
  );
}
