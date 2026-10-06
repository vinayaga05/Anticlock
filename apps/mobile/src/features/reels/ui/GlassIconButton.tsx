import React from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { AppIcon, type IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';

/** Minimum touch target for every icon control in the Reels creator. */
export const HIT = 44;

/**
 * Frosted dark backdrop. iOS uses a native blur; Android falls back to a
 * translucent fill (community BlurView is expensive and flaky inside many small
 * views on Android).
 */
export function GlassFill({
  radius,
  tint = 'rgba(0,0,0,0.32)',
  androidTint = 'rgba(0,0,0,0.5)',
}: {
  radius?: number;
  tint?: string;
  androidTint?: string;
}) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius }]}>
      {Platform.OS === 'ios' ? (
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType="dark"
          blurAmount={18}
          reducedTransparencyFallbackColor="rgba(20,20,24,0.9)"
        />
      ) : null}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: Platform.OS === 'ios' ? tint : androidTint },
        ]}
      />
    </View>
  );
}

type Props = {
  icon: IconName;
  accessibilityLabel: string;
  onPress?: () => void;
  disabled?: boolean;
  /** White filled circle with a dark icon. */
  active?: boolean;
  /** Skip the frosted backdrop (icon floats on the preview). */
  bare?: boolean;
  size?: number;
  iconSize?: number;
  /** Tiny corner badge, e.g. the selected duration. */
  badge?: string;
  /** Tiny caption under the icon. */
  caption?: string;
  radius?: number;
  iconFill?: string;
  style?: ViewStyle;
};

/** Round, translucent, white-icon button with a 44pt hit target. */
export function GlassIconButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled,
  active,
  bare,
  size = HIT,
  iconSize = 22,
  badge,
  caption,
  radius,
  iconFill,
  style,
}: Props) {
  const r = radius ?? size / 2;
  const box = Math.max(HIT, size);
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.hit,
        { minWidth: box, minHeight: box },
        ...(disabled ? [styles.disabled] : []),
        ...(style ? [style] : []),
      ]}
    >
      <View style={[styles.circle, { width: size, height: size, borderRadius: r }, active && styles.active]}>
        {!active && !bare ? <GlassFill radius={r} /> : null}
        <AppIcon
          name={icon}
          size={iconSize}
          color={active ? '#111' : '#fff'}
          strokeWidth={2}
          fill={iconFill}
        />
        {badge ? (
          <View style={styles.badge} pointerEvents="none">
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      {caption ? (
        <Text style={styles.caption} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  hit: { alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  circle: { alignItems: 'center', justifyContent: 'center' },
  active: { backgroundColor: '#fff' },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    minWidth: 18,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#111', fontSize: 9, fontWeight: '800', fontVariant: ['tabular-nums'] },
  caption: { marginTop: 3, color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '600' },
});
