import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { AppIcon } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
import { palette } from '@/shared/theme/colors';
import type { PublisherProfileType } from './publisherSelection';

type Props = {
  type: PublisherProfileType;
  /** On imagery (active profile card): light glass pill. */
  onMedia?: boolean;
  compact?: boolean;
};

/** Small Personal / Business pill with its icon. */
export function ProfileTypeBadge({ type, onMedia = false, compact = false }: Props) {
  const theme = useTheme();
  const business = type === 'business';
  const fg = onMedia
    ? '#FFFFFF'
    : business
      ? palette.indigoDeep
      : theme.colors.textSecondary;
  const bg = onMedia
    ? 'rgba(255,255,255,0.2)'
    : business
      ? palette.indigoSoft
      : theme.colors.surfaceMuted;
  return (
    <View
      accessibilityLabel={business ? 'Business profile' : 'Personal profile'}
      style={[styles.pill, compact && styles.compact, { backgroundColor: bg }]}>
      <AppIcon
        name={business ? 'briefcase' : 'user-round'}
        size={compact ? 11 : 12}
        color={fg}
        strokeWidth={2.25}
      />
      <Text style={[styles.label, compact && styles.labelCompact, { color: fg }]}>
        {business ? 'Business' : 'Personal'}
      </Text>
    </View>
  );
}

export type StatusTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

/** Compact state chip (e.g. Approved / Under review / Action required). */
export function StatusChip({
  label,
  tone,
  testID,
  style,
}: {
  label: string;
  tone: StatusTone;
  testID?: string;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const colors: Record<StatusTone, { fg: string; bg: string }> = {
    success: { fg: '#15803D', bg: 'rgba(34, 197, 94, 0.14)' },
    info: { fg: palette.skyDeep, bg: palette.skySoft },
    warning: { fg: palette.amberDeep, bg: palette.amberSoft },
    danger: { fg: theme.colors.error, bg: 'rgba(239, 68, 68, 0.12)' },
    neutral: { fg: theme.colors.textSecondary, bg: theme.colors.surfaceMuted },
  };
  const { fg, bg } = colors[tone];
  return (
    <View testID={testID} style={[styles.chip, { backgroundColor: bg }, style]}>
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <Text style={[styles.chipLabel, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  compact: { paddingHorizontal: 6, paddingVertical: 2 },
  label: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.2 },
  labelCompact: { fontSize: 10.5 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipLabel: { fontSize: 11.5, fontWeight: '700' },
});
