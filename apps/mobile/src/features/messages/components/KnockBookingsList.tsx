import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FilterPills } from '@/shared/components/FilterPills';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { BookingCard } from '@/features/booking/components/BookingCard';
import {
  BookingFilter,
  ConsolidatedBooking,
  filterBookings,
  getConsolidatedBookings,
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

  const onViewDetails = (_booking: ConsolidatedBooking) => {
    navigation.navigate('MyBookings');
  };

  return (
    <View style={styles.wrap}>
      {showHeading ? (
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>Bookings</Text>
      ) : null}
      <FilterPills
        activeId={filter}
        onChange={id => setFilter(id as BookingFilter)}
        pills={[
          { id: 'all', label: 'All' },
          { id: 'online', label: 'Online' },
          { id: 'all_class', label: 'All Class' },
        ]}
      />
      {items.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No bookings in this filter"
          description="Try All to see every booking, or book a new session."
          actionLabel="Find services"
          onAction={() => navigation.navigate('Doctors')}
        />
      ) : (
        <View style={styles.list}>
          {items.map(item => (
            <BookingCard key={item.id} booking={item} onViewDetails={onViewDetails} />
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
