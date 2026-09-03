import React, { PropsWithChildren } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useTheme } from '@/shared/hooks/useTheme';
import { healthTheme } from '@/shared/theme/healthTheme';

type Intensity = 'light' | 'medium' | 'heavy';
type GlassVariant = 'default' | 'health';

type GlassProps = PropsWithChildren<
  ViewProps & {
    intensity?: Intensity;
    variant?: GlassVariant;
    style?: ViewStyle | ViewStyle[];
    /** Native frosted blur when available (iOS / Android BlurView). */
    blur?: boolean;
    radius?: number;
    elevated?: boolean;
  }
>;

/**
 * Soft translucent surface. Health variant uses CliniQ-style frosted panels.
 */
export function Glass({
  children,
  intensity = 'medium',
  variant = 'default',
  style,
  blur = false,
  radius,
  elevated = false,
  ...rest
}: GlassProps) {
  const theme = useTheme();
  const tokens =
    variant === 'health' ? theme.healthGlass[intensity] : theme.glass[intensity];
  const borderRadius = radius ?? (variant === 'health' ? healthTheme.radiusMd : theme.radius.xl);
  const shadow =
    variant === 'health' && elevated
      ? theme.shadows.healthSoft
      : Platform.OS === 'ios'
        ? theme.shadows.soft
        : null;
  const blurType = theme.mode === 'dark' ? 'dark' : 'light';
  const fallback =
    theme.mode === 'dark' ? 'rgba(20,20,24,0.92)' : 'rgba(255,255,255,0.94)';

  return (
    <View
      style={[
        styles.inner,
        {
          backgroundColor: blur ? 'transparent' : tokens.background,
          borderColor: tokens.border,
          borderRadius,
        },
        shadow,
        style,
      ]}
      {...rest}>
      {blur ? (
        <>
          <BlurView
            style={StyleSheet.absoluteFill}
            blurType={blurType}
            blurAmount={theme.glass.blurAmount}
            {...(Platform.OS === 'ios'
              ? { reducedTransparencyFallbackColor: fallback }
              : { overlayColor: 'transparent' })}
          />
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: tokens.background }]}
          />
        </>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
