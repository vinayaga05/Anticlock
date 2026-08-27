import React, { PropsWithChildren } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';

type Intensity = 'light' | 'medium' | 'heavy';

type GlassProps = PropsWithChildren<
  ViewProps & {
    intensity?: Intensity;
    style?: ViewStyle | ViewStyle[];
    blur?: boolean;
    radius?: number;
  }
>;

/**
 * Soft translucent surface. BlurView is disabled by default because
 * @react-native-community/blur often renders "Unimplemented component"
 * under New Architecture — solid translucent fill keeps UI stable.
 */
export function Glass({
  children,
  intensity = 'medium',
  style,
  blur: _blur = false,
  radius,
  ...rest
}: GlassProps) {
  const theme = useTheme();
  const glass = theme.glass[intensity];
  const borderRadius = radius ?? theme.radius.xl;

  return (
    <View
      style={[
        styles.inner,
        {
          backgroundColor: glass.background,
          borderColor: glass.border,
          borderRadius,
        },
        Platform.OS === 'ios' ? theme.shadows.soft : null,
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
