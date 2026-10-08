import React, { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon, type IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { StatusChip, type StatusTone } from '@/shared/publishing/ProfileTypeBadge';

/** Compact grouped section: short label + rounded card. */
export function SettingsSection({
  label,
  children,
  testID,
}: PropsWithChildren<{ label?: string; testID?: string }>) {
  const theme = useTheme();
  return (
    <View style={styles.section} testID={testID}>
      {label ? (
        <Text style={[styles.sectionLabel, { color: theme.colors.textTertiary }]}>{label}</Text>
      ) : null}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}>
        {children}
      </View>
    </View>
  );
}

export type RowTone = 'default' | 'danger';

/** Icon row; chevron only when it navigates. */
export function SettingsRow({
  icon,
  label,
  onPress,
  chip,
  value,
  navigates = true,
  tone = 'default',
  iconTint,
  divider = true,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  chip?: { label: string; tone: StatusTone } | null;
  value?: string;
  navigates?: boolean;
  tone?: RowTone;
  iconTint?: { fg: string; bg: string };
  divider?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const danger = tone === 'danger';
  const fg = danger ? theme.colors.error : iconTint?.fg ?? theme.colors.textPrimary;
  const bg = danger ? 'rgba(239, 68, 68, 0.1)' : iconTint?.bg ?? theme.colors.surfaceMuted;
  return (
    <View>
      <PressableScale
        testID={testID}
        accessibilityLabel={chip ? `${label}, ${chip.label}` : label}
        onPress={onPress}
        scaleTo={0.985}
        style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: bg }]}>
          <AppIcon name={icon} size={19} color={fg} strokeWidth={2} />
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.rowLabel,
            { color: danger ? theme.colors.error : theme.colors.textPrimary },
          ]}>
          {label}
        </Text>
        {chip ? <StatusChip label={chip.label} tone={chip.tone} style={styles.rowChip} /> : null}
        {value ? (
          <Text style={[styles.value, { color: theme.colors.textTertiary }]}>{value}</Text>
        ) : null}
        {navigates ? (
          <AppIcon name="chevron-right" size={18} color={theme.colors.textMuted} strokeWidth={2.25} />
        ) : null}
      </PressableScale>
      {divider ? (
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
      ) : null}
    </View>
  );
}

export type Tile = {
  id: string;
  label: string;
  icon: IconName;
  onPress: () => void;
  tint: { fg: string; bg: string };
};

/** Icon tile grid (4 per row) for quick destinations. */
export function TileGrid({ tiles, columns = 4 }: { tiles: Tile[]; columns?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.tiles}>
      {tiles.map(tile => (
        <PressableScale
          key={tile.id}
          testID={`tile-${tile.id}`}
          accessibilityLabel={tile.label}
          onPress={tile.onPress}
          style={[styles.tile, { width: `${100 / columns}%` as `${number}%` }]}>
          <View style={[styles.tileIcon, { backgroundColor: tile.tint.bg }]}>
            <AppIcon name={tile.icon} size={22} color={tile.tint.fg} strokeWidth={2} />
          </View>
          <Text
            numberOfLines={1}
            style={[styles.tileLabel, { color: theme.colors.textPrimary }]}>
            {tile.label}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 6,
  },
  card: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    minHeight: 56,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
  value: { fontSize: 14, fontWeight: '600' },
  rowChip: { alignSelf: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 10 },
  tile: { alignItems: 'center', gap: 7, paddingVertical: 8 },
  tileIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { fontSize: 12.5, fontWeight: '600' },
});
