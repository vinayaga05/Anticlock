import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { Glass } from '@/shared/components/Glass';
import { healthTheme } from '@/shared/theme/healthTheme';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'glass'
  | 'ghost'
  | 'destructive'
  | 'icon'
  | 'floating'
  | 'health';

type Props = {
  title?: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  icon,
  iconPosition = 'left',
  style,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const isIconOnly = variant === 'icon' || (!title && !!icon);
  const isDark = theme.mode === 'dark';

  const colors = (() => {
    switch (variant) {
      case 'secondary':
        return {
          bg: theme.colors.primarySoft,
          text: theme.colors.primaryMuted,
          border: 'transparent',
        };
      case 'ghost':
        return {
          bg: 'transparent',
          text: theme.colors.primary,
          border: 'transparent',
        };
      case 'destructive':
        return {
          bg: 'rgba(239,68,68,0.12)',
          text: theme.colors.error,
          border: 'rgba(239,68,68,0.22)',
        };
      case 'glass':
      case 'floating':
        return {
          bg: theme.glass.medium.background,
          text: theme.colors.textPrimary,
          border: theme.glass.medium.border,
        };
      case 'health':
        return {
          bg: healthTheme.navy,
          text: healthTheme.white,
          border: 'transparent',
        };
      case 'icon':
        return {
          bg: theme.colors.surfaceSecondary,
          text: theme.colors.textPrimary,
          border: theme.colors.border,
        };
      default:
        return {
          bg: theme.colors.primary,
          text: isDark ? '#042F2E' : '#FFFFFF',
          border: 'transparent',
        };
    }
  })();

  const content = (
    <View
      style={[
        styles.base,
        isIconOnly && styles.iconOnly,
        {
          backgroundColor:
            variant === 'glass' || variant === 'floating' ? 'transparent' : colors.bg,
          borderColor: colors.border,
          borderWidth: variant === 'ghost' ? 0 : StyleSheet.hairlineWidth,
          borderRadius: variant === 'floating' ? theme.radius.pill : theme.radius.lg,
          opacity: disabled ? 0.5 : 1,
          minHeight: isIconOnly ? 44 : 54,
          paddingHorizontal: isIconOnly ? 0 : theme.spacing.xl,
          ...(variant === 'primary' ? theme.shadows.glowTeal : {}),
          ...(variant === 'floating' ? theme.shadows.float : {}),
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={styles.row}>
          {icon && iconPosition === 'left' ? (
            <AppIcon name={icon} size={18} color={colors.text} />
          ) : null}
          {title ? (
            <Text style={[styles.label, { color: colors.text }]}>{title}</Text>
          ) : null}
          {icon && iconPosition === 'right' ? (
            <AppIcon name={icon} size={18} color={colors.text} />
          ) : null}
        </View>
      )}
    </View>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel ?? title}
      style={variant === 'floating' ? theme.shadows.float : undefined}>
      {variant === 'glass' || variant === 'floating' ? (
        <Glass
          intensity="medium"
          radius={theme.radius.lg}
          style={{ backgroundColor: 'transparent' }}>
          {content}
        </Glass>
      ) : (
        content
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOnly: {
    width: 44,
    height: 44,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
