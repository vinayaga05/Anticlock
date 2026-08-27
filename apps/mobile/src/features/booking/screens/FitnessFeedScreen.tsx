import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { SearchBar } from '@/shared/components/SearchBar';
import { fitnessClasses } from '@/shared/data/mocks';
import { BookingCard } from '@/features/booking/components/BookingCard';
import { BookingFilterBar } from '@/features/booking/components/BookingFilterBar';
import {
  BookingFilter,
  filterBookings,
  fitnessClassToBooking,
  getConsolidatedBookings,
  navigateBookingTarget,
} from '@/shared/data/bookings';

export function FitnessFeedScreen() {
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<BookingFilter>('all_class');

  const items = useMemo(() => {
    if (filter === 'all_class') {
      return fitnessClasses.map(fitnessClassToBooking);
    }
    const all = getConsolidatedBookings();
    return filterBookings(all, filter);
  }, [filter]);

  return (
    <ScreenContainer scrollable tabAware={false}>
      <SearchBar placeholder="Search classes" />
      <BookingFilterBar active={filter} onChange={setFilter} />
      <View style={styles.list}>
        {items.map(item => (
          <BookingCard
            key={item.id}
            booking={item}
            onPress={booking => navigateBookingTarget(navigation, booking)}
          />
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 16,
    marginTop: 4,
  },
});
