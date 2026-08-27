import React, { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { PressableScale } from '@/shared/components/PressableScale';

type Props = PropsWithChildren<{
  style?: ViewStyle;
  onPress?: () => void;
  padded?: boolean;
  elevated?: boolean;
  tint?: string;
}>;

export function Card({
  children,
  style,
  onPress,
  padded = true,
  elevated = true,
  tint,
}: Props) {
  const theme = useTheme();

  const visualStyle: ViewStyle = {
    backgroundColor: tint ?? theme.colors.surface,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.xl,
    padding: padded ? theme.spacing.lg : 0,
    ...(elevated ? (theme.shadows.soft as ViewStyle) : {}),
  };

  // Layout that must size the pressable cell (grids) stays on the wrapper.
  const wrapperStyle: ViewStyle | undefined = style
    ? {
        width: style.width,
        flex: style.flex,
        flexGrow: style.flexGrow,
        alignSelf: style.alignSelf,
      }
    : undefined;

  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={wrapperStyle}>
        <View style={[styles.card, visualStyle, styles.fill, style]}>
          {children}
        </View>
      </PressableScale>
    );
  }

  return (
    <View style={[styles.card, visualStyle, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
  },
});
