import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { Glass } from '@/shared/components/Glass';

type Props = {
  name: IconName;
  onPress?: () => void;
  size?: number;
  color?: string;
  active?: boolean;
  glass?: boolean;
  accessibilityLabel: string;
  style?: ViewStyle;
};

export function IconButton({
  name,
  onPress,
  size = 22,
  color,
  active,
  glass = false,
  accessibilityLabel,
  style,
}: Props) {
  const theme = useTheme();
  const iconColor =
    color ?? (active ? theme.colors.primary : theme.colors.textPrimary);

  const content = (
    <View
      style={[
        styles.hit,
        {
          backgroundColor: glass ? 'transparent' : theme.colors.surfaceMuted,
          borderRadius: theme.radius.pill,
        },
        style,
      ]}>
      <AppIcon
        name={name}
        size={size}
        color={iconColor}
        strokeWidth={active ? 2.1 : theme.icons.stroke}
      />
    </View>
  );

  return (
    <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel}>
      {glass ? (
        <Glass intensity="light" radius={theme.radius.pill} blur={false}>
          {content}
        </Glass>
      ) : (
        content
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
