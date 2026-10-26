import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/shared/components/PressableScale';
import { AppIcon } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
import { BookingFilter } from '@/shared/data/bookings';

const FILTERS: { id: BookingFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'on_site', label: 'On-site' },
  { id: 'online', label: 'Online' },
  { id: 'classes', label: 'Classes' },
];

type Props = {
  active: BookingFilter;
  onChange: (filter: BookingFilter) => void;
  onOpenFilters?: () => void;
  counts?: { all: number; onSite: number; online: number; classes: number };
};

export function BookingFilterBar({ active, onChange, onOpenFilters, counts }: Props) {
  const theme = useTheme();
  const countFor = (filter: BookingFilter) => {
    if (!counts) return null;
    if (filter === 'on_site') return counts.onSite;
    return counts[filter];
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {FILTERS.map(item => {
          const isActive = item.id === active;
          return (
            <PressableScale
              key={item.id}
              onPress={() => onChange(item.id)}
              accessibilityLabel={item.label}
              style={[
                styles.pill,
                {
                  backgroundColor: isActive
                    ? theme.colors.primary
                    : theme.colors.surfaceSecondary,
                  borderColor: isActive ? theme.colors.primary : theme.colors.borderSoft,
                },
              ]}>
              <Text
                style={[
                  styles.label,
                  { color: isActive ? '#FFFFFF' : theme.colors.textSecondary },
                ]}>
                {item.label}
              </Text>
              {countFor(item.id) !== null ? (
                <View
                  style={[
                    styles.count,
                    {
                      backgroundColor: isActive
                        ? 'rgba(255,255,255,0.22)'
                        : theme.colors.surface,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.countText,
                      { color: isActive ? '#FFFFFF' : theme.colors.textSecondary },
                    ]}>
                    {countFor(item.id)}
                  </Text>
                </View>
              ) : null}
            </PressableScale>
          );
        })}
      </ScrollView>
      {onOpenFilters ? (
        <PressableScale
          onPress={onOpenFilters}
          accessibilityLabel="Filters"
          style={[styles.filterIcon, { borderColor: theme.colors.borderSoft }]}>
          <AppIcon name="settings" size={18} color={theme.colors.textSecondary} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
    flexGrow: 1,
  },
  pill: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  count: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countText: { fontSize: 10, fontWeight: '800' },
  filterIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
