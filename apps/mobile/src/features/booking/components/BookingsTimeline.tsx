import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { EmptyState } from '@/shared/components/EmptyState';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { BookingFilterBar } from '@/features/booking/components/BookingFilterBar';
import { BookingFilterSheet } from '@/features/booking/components/BookingFilterSheet';
import { BookingTimelineSection } from '@/features/booking/components/BookingTimelineSection';
import { NextUpBookingCard } from '@/features/booking/components/NextUpBookingCard';
import { UnifiedBookingCard } from '@/features/booking/components/UnifiedBookingCard';
import {
  applyAdvancedFilters,
  BookingAction,
  BookingAdvancedFilters,
  BookingFilter,
  ConsolidatedBooking,
  DEFAULT_ADVANCED_FILTERS,
  filterBookings,
  getConsolidatedBookings,
  getPastBookings,
  groupBookingsByTimeline,
  navigateBookingTarget,
} from '@/shared/data/bookings';

export function BookingsTimeline() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<BookingFilter>('all');
  const [advanced, setAdvanced] = useState<BookingAdvancedFilters>(DEFAULT_ADVANCED_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pastExpanded, setPastExpanded] = useState(false);

  const filtered = useMemo(() => {
    const all = getConsolidatedBookings();
    const tabbed = filterBookings(all, filter);
    return applyAdvancedFilters(tabbed, advanced);
  }, [filter, advanced]);

  const { nextUp, sections } = useMemo(
    () => groupBookingsByTimeline(filtered),
    [filtered],
  );

  const past = useMemo(() => getPastBookings(filtered), [filtered]);
  const pastPreview = pastExpanded ? past : past.slice(0, 2);

  const onPress = (booking: ConsolidatedBooking) => {
    navigateBookingTarget(navigation, booking);
  };

  const onAction = (booking: ConsolidatedBooking, action: BookingAction) => {
    if (action === 'view_details' || action === 'prepare') {
      navigateBookingTarget(navigation, booking);
      return;
    }
    if (action === 'join_now') {
      Alert.alert('Join session', `Opening ${booking.serviceTitle}…`);
      return;
    }
    if (action === 'book_again') {
      navigation.navigate('Needs');
      return;
    }
    Alert.alert(action.replace('_', ' '), 'Coming soon.');
  };

  const hasUpcoming = nextUp || sections.some(s => s.items.length > 0);

  return (
    <View style={styles.wrap}>
      <BookingFilterBar
        active={filter}
        onChange={setFilter}
        onOpenFilters={() => setSheetOpen(true)}
      />

      {!hasUpcoming && past.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No bookings in this filter"
          description="Try All to see everything, or book a new session."
          actionLabel="Find services"
          onAction={() => navigation.navigate('Needs')}
        />
      ) : (
        <View style={styles.timeline}>
          {nextUp ? (
            <NextUpBookingCard booking={nextUp} onPress={onPress} onAction={onAction} />
          ) : null}

          {sections.map(section => (
            <BookingTimelineSection
              key={section.label}
              section={section}
              onPress={onPress}
              onAction={onAction}
            />
          ))}

          {past.length > 0 ? (
            <View style={styles.pastWrap}>
              <View style={styles.pastHeader}>
                <Text style={[styles.pastTitle, { color: theme.colors.textSecondary }]}>
                  Past bookings
                </Text>
                {past.length > 2 ? (
                  <PressableScale onPress={() => setPastExpanded(v => !v)}>
                    <Text style={[styles.pastLink, { color: theme.colors.primary }]}>
                      {pastExpanded ? 'Show less' : 'See all >'}
                    </Text>
                  </PressableScale>
                ) : null}
              </View>
              <View style={styles.pastList}>
                {pastPreview.map(booking => (
                  <UnifiedBookingCard
                    key={booking.id}
                    booking={booking}
                    onPress={onPress}
                    onAction={onAction}
                    compact
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      )}

      <BookingFilterSheet
        visible={sheetOpen}
        filters={advanced}
        onChange={setAdvanced}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  timeline: { gap: 18 },
  pastWrap: { gap: 10, marginTop: 4 },
  pastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pastTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pastLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  pastList: { gap: 10 },
});
