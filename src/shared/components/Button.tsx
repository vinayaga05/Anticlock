import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';

type Props = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  variant?: 'primary' | 'success' | 'outline' | 'muted';
  style?: ViewStyle;
};

export function Button({
  title,
  onPress,
  loading,
  variant = 'primary',
  style,
}: Props) {
  const theme = useTheme();

  const bg =
    variant === 'success'
      ? theme.colors.green
      : variant === 'outline'
        ? 'transparent'
        : variant === 'muted'
          ? theme.colors.navy
          : theme.colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={[
        styles.btn,
        {
          backgroundColor: bg,
          borderColor: theme.colors.primary,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderRadius: theme.radius.lg,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text
          style={[
            styles.text,
            { color: variant === 'outline' ? theme.colors.primary : '#fff' },
          ]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  text: {
    fontWeight: '700',
    fontSize: 14,
  },
});
