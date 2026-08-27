import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { BookingCard } from '@/features/booking/components/BookingCard';
import { BookingFilterBar } from '@/features/booking/components/BookingFilterBar';
import {
  BookingFilter,
  ConsolidatedBooking,
  filterBookings,
  getConsolidatedBookings,
  navigateBookingTarget,
} from '@/shared/data/bookings';

type Props = {
  showHeading?: boolean;
};

export function KnockBookingsList({ showHeading = true }: Props) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<BookingFilter>('all');

  const items = useMemo(() => {
    const all = getConsolidatedBookings();
    return filterBookings(all, filter);
  }, [filter]);

  const onPress = (booking: ConsolidatedBooking) => {
    navigateBookingTarget(navigation, booking);
  };

  return (
    <View style={styles.wrap}>
      {showHeading ? (
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>Bookings</Text>
      ) : null}
      <BookingFilterBar active={filter} onChange={setFilter} />
      {items.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No bookings in this filter"
          description="Try My Booking to see everything, or book a new session."
          actionLabel="Find services"
          onAction={() => navigation.navigate('Doctors')}
        />
      ) : (
        <View style={styles.list}>
          {items.map(item => (
            <BookingCard key={item.id} booking={item} onPress={onPress} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
  },
  list: {
    gap: 16,
  },
});
