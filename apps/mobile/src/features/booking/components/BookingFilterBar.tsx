import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/shared/components/PressableScale';
import { BookingFilter } from '@/shared/data/bookings';

const FILTERS: {
  id: BookingFilter;
  label: string;
  activeBg: string;
  activeText: string;
}[] = [
  { id: 'all', label: 'My Booking', activeBg: '#38BDF8', activeText: '#FFFFFF' },
  { id: 'online', label: 'Online', activeBg: '#22C55E', activeText: '#FFFFFF' },
  { id: 'all_class', label: 'All Class', activeBg: '#14B8A6', activeText: '#FFFFFF' },
];

type Props = {
  active: BookingFilter;
  onChange: (filter: BookingFilter) => void;
};

export function BookingFilterBar({ active, onChange }: Props) {
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
                  backgroundColor: isActive ? item.activeBg : 'rgba(148,163,184,0.12)',
                },
              ]}>
              <Text
                style={[
                  styles.label,
                  { color: isActive ? item.activeText : '#64748B' },
                ]}>
                {item.label}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: -2,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 2,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    minWidth: 108,
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
