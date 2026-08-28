import React, { PropsWithChildren } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { healthTheme } from '@/shared/theme/healthTheme';

type Intensity = 'light' | 'medium' | 'heavy';
type GlassVariant = 'default' | 'health';

type GlassProps = PropsWithChildren<
  ViewProps & {
    intensity?: Intensity;
    variant?: GlassVariant;
    style?: ViewStyle | ViewStyle[];
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
  blur: _blur = false,
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

  return (
    <View
      style={[
        styles.inner,
        {
          backgroundColor: tokens.background,
          borderColor: tokens.border,
          borderRadius,
        },
        shadow,
        style,
      ]}
      {...rest}>
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
