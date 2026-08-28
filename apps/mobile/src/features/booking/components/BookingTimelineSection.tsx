import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  BookingAction,
  ConsolidatedBooking,
  TimelineSection,
} from '@/shared/data/bookings';
import { UnifiedBookingCard } from '@/features/booking/components/UnifiedBookingCard';

type Props = {
  section: TimelineSection;
  onPress?: (booking: ConsolidatedBooking) => void;
  onAction?: (booking: ConsolidatedBooking, action: BookingAction) => void;
};

export function BookingTimelineSection({ section, onPress, onAction }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
        {section.label.replace('_', ' ')}
      </Text>
      <View style={styles.list}>
        {section.items.map(booking => (
          <UnifiedBookingCard
            key={booking.id}
            booking={booking}
            onPress={onPress}
            onAction={onAction}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  list: { gap: 10 },
});
