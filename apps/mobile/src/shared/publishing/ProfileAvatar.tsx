import React, { useState } from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { AppIcon } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
import { palette } from '@/shared/theme/colors';

const FALLBACK_TINTS = [
  palette.aquaDeep,
  palette.indigoDeep,
  palette.coralDeep,
  palette.lavenderDeep,
  palette.amberDeep,
  palette.skyDeep,
  palette.pinkDeep,
];

export function profileInitials(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0]!.charAt(0);
  const second = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : '';
  return `${first}${second}`.toUpperCase();
}

function tintFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return FALLBACK_TINTS[Math.abs(hash) % FALLBACK_TINTS.length]!;
}

type Props = {
  name: string;
  uri?: string | null;
  size: number;
  /** Business logos render as rounded squares, people as circles. */
  business?: boolean;
  /** Strong ring for the active profile. */
  active?: boolean;
  /** Check badge on the active profile. */
  showCheck?: boolean;
  /** Muted look for a profile that cannot be selected yet. */
  dimmed?: boolean;
  /** Color behind the check badge border (matches the surface behind). */
  badgeBorderColor?: string;
  ringColor?: string;
  /** Check badge fill (defaults to the ring color). */
  checkColor?: string;
  style?: ViewStyle;
  testID?: string;
};

/**
 * Real profile photo / business logo with an initials fallback (no generic
 * illustration when the user has media). Active profiles get a ring + check.
 */
export function ProfileAvatar({
  name,
  uri,
  size,
  business = false,
  active = false,
  showCheck = false,
  dimmed = false,
  badgeBorderColor,
  ringColor,
  checkColor,
  style,
  testID,
}: Props) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  const radius = business ? Math.round(size * 0.3) : size / 2;
  const ringWidth = size >= 64 ? 3 : 2.5;
  const gap = size >= 64 ? 3 : 2;
  const outer = size + (ringWidth + gap) * 2;
  const outerRadius = business ? radius + ringWidth + gap : outer / 2;
  const checkSize = Math.max(18, Math.round(size * 0.34));
  const showImage = Boolean(uri) && !failed;

  return (
    <View
      testID={testID}
      style={[
        {
          width: outer,
          height: outer,
          borderRadius: outerRadius,
          borderWidth: ringWidth,
          borderColor: active ? ringColor ?? theme.colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: dimmed ? 0.62 : 1,
        },
        style,
      ]}>
      {showImage ? (
        <Image
          source={{ uri: uri! }}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: theme.colors.surfaceMuted,
          }}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: tintFor(name),
            },
          ]}>
          {business && !profileInitials(name) ? (
            <AppIcon name="store" size={size * 0.42} color="#FFFFFF" strokeWidth={2} />
          ) : (
            <Text style={[styles.initials, { fontSize: Math.round(size * 0.36) }]}>
              {profileInitials(name)}
            </Text>
          )}
        </View>
      )}
      {showCheck ? (
        <View
          style={[
            styles.check,
            {
              width: checkSize,
              height: checkSize,
              borderRadius: checkSize / 2,
              backgroundColor: checkColor ?? ringColor ?? theme.colors.primary,
              borderColor: badgeBorderColor ?? theme.colors.surface,
              right: business ? -2 : 0,
              bottom: business ? -2 : 0,
            },
          ]}>
          <AppIcon name="check" size={checkSize * 0.58} color="#FFFFFF" strokeWidth={3} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.5 },
  check: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});
