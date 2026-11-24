import React, { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { PressableScale } from '@/shared/components/PressableScale';
import { elevatedSurface } from '@/shared/theme/elevatedSurface';

type Props = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
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
  const customStyle = StyleSheet.flatten(style);

  const visualStyle: ViewStyle = {
    backgroundColor: tint ?? theme.colors.surface,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.xl,
    padding: padded ? theme.spacing.lg : 0,
    ...(elevated ? (theme.shadows.soft as ViewStyle) : {}),
  };

  // Layout that must size the pressable cell (grids) stays on the wrapper.
  const wrapperStyle: ViewStyle | undefined = customStyle
    ? {
        width: customStyle.width,
        flex: customStyle.flex,
        flexGrow: customStyle.flexGrow,
        alignSelf: customStyle.alignSelf,
      }
    : undefined;

  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={wrapperStyle}>
        <View style={elevatedSurface(StyleSheet.flatten([styles.card, visualStyle, styles.fill, style]), theme.colors.surface)}>
          {children}
        </View>
      </PressableScale>
    );
  }

  return (
    <View style={elevatedSurface(StyleSheet.flatten([styles.card, visualStyle, style]), theme.colors.surface)}>{children}</View>
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
