import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { PressableScale } from '@/shared/components/PressableScale';
import { AppIcon } from '@/shared/components/AppIcon';
import { softFill } from '@/shared/theme/colors';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accent?: string;
  showCheck?: boolean;
};

export function AppChip({
  label,
  selected,
  onPress,
  accent,
  showCheck,
}: Props) {
  const theme = useTheme();
  const tint = accent ?? theme.colors.primary;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? softFill(tint, 0.18) : theme.colors.surface,
          borderColor: selected ? tint : theme.colors.border,
          borderRadius: theme.radius.pill,
        },
      ]}>
      {selected && showCheck ? (
        <AppIcon name="check" size={14} color={tint} strokeWidth={2.5} />
      ) : null}
      <Text
        style={[
          theme.typography.bodySmall,
          {
            color: selected ? tint : theme.colors.textSecondary,
            fontWeight: '600',
          },
        ]}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
