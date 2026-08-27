import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { softFill } from '@/shared/theme/colors';

type Props = {
  name: IconName;
  color: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'rounded' | 'circle';
  style?: ViewStyle;
  softBackground?: string;
};

const SIZES = {
  sm: { box: 36, icon: 18 },
  md: { box: 44, icon: 22 },
  lg: { box: 56, icon: 26 },
  xl: { box: 72, icon: 32 },
};

export function IconBadge({
  name,
  color,
  size = 'md',
  shape = 'rounded',
  style,
  softBackground,
}: Props) {
  const theme = useTheme();
  const dim = SIZES[size];

  return (
    <View
      style={[
        styles.badge,
        {
          width: dim.box,
          height: dim.box,
          backgroundColor: softBackground ?? softFill(color, 0.16),
          borderRadius: shape === 'circle' ? dim.box / 2 : theme.radius.md,
        },
        style,
      ]}>
      <AppIcon name={name} size={dim.icon} color={color} strokeWidth={1.75} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
