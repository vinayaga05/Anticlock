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
};

export function BookingFilterBar({ active, onChange, onOpenFilters }: Props) {
  const theme = useTheme();

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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
