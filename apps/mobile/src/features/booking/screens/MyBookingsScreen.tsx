import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { AppHeader } from '@/shared/components/AppHeader';
import { SearchBar } from '@/shared/components/SearchBar';
import { BookingsTimeline } from '@/features/booking/components/BookingsTimeline';

export function MyBookingsScreen() {
  const navigation = useNavigation<any>();

  return (
    <ScreenContainer scrollable>
      <AppHeader />
      <SearchBar placeholder="Search bookings" />
      <BookingsTimeline />
      <View style={styles.footer}>
        <Button
          title="Book again"
          icon="calendar"
          onPress={() => navigation.navigate('Needs')}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: 8,
  },
});
