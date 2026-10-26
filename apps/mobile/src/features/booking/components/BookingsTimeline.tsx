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
import { useBookingsQuery } from '@/shared/api';
import { useCancelAnyBookingMutation } from '@/shared/api/bookingHooks';
import { isApiEnabled } from '@/shared/api/config';
import { readStoredSession } from '@/shared/services/auth/authService';
import { mapApiBookingToConsolidated } from '@/shared/utils/bookingMappers';
import {
  applyAdvancedFilters,
  BookingAction,
  BookingAdvancedFilters,
  BookingFilter,
  ConsolidatedBooking,
  DEFAULT_ADVANCED_FILTERS,
  getPastBookings,
  groupBookingsByTimeline,
  navigateBookingTarget,
} from '@/shared/data/bookings';

type BookingsTimelineProps = {
  filterSheetOpen?: boolean;
  onFilterSheetOpenChange?: (open: boolean) => void;
  showFilterButton?: boolean;
  searchQuery?: string;
};

export function BookingsTimeline({
  filterSheetOpen,
  onFilterSheetOpenChange,
  showFilterButton = true,
  searchQuery = '',
}: BookingsTimelineProps) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<BookingFilter>('all');
  const [advanced, setAdvanced] = useState<BookingAdvancedFilters>(DEFAULT_ADVANCED_FILTERS);
  const [internalSheetOpen, setInternalSheetOpen] = useState(false);
  const [pastExpanded, setPastExpanded] = useState(false);
  const cancelBooking = useCancelAnyBookingMutation();

  const sheetOpen = filterSheetOpen ?? internalSheetOpen;
  const setSheetOpen = onFilterSheetOpenChange ?? setInternalSheetOpen;

  // Bookings are server-owned; never show fixture bookings to signed-in users.
  const authenticated = Boolean(readStoredSession()?.token);
  const {
    data: apiData,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useBookingsQuery(filter);

  const allBookings = useMemo(() => {
    return isApiEnabled
      ? (apiData?.pages.flatMap(page => page.bookings) ?? []).map(
          mapApiBookingToConsolidated,
        )
      : [];
  }, [apiData]);

  const counts = apiData?.pages[0]?.counts;

  const filtered = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    const searched = needle
      ? allBookings.filter(booking =>
          [booking.providerName, booking.serviceTitle, booking.customerName]
            .filter(Boolean)
            .some(value => value!.toLowerCase().includes(needle)),
        )
      : allBookings;
    return applyAdvancedFilters(searched, advanced);
  }, [allBookings, searchQuery, advanced]);

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
    if (action === 'cancel') {
      Alert.alert(
        'Cancel booking?',
        'The provider will be notified immediately.',
        [
          { text: 'Keep booking', style: 'cancel' },
          {
            text: 'Cancel booking',
            style: 'destructive',
            onPress: () =>
              cancelBooking.mutate(
                { bookingId: booking.id, reason: 'Cancelled by customer' },
                {
                  onError: (err: unknown) =>
                    Alert.alert(
                      'Could not cancel',
                      err instanceof Error ? err.message : 'Please try again.',
                    ),
                },
              ),
          },
        ],
      );
      return;
    }
    Alert.alert(action.replace('_', ' '), 'Coming soon.');
  };

  const hasUpcoming = nextUp || sections.some(s => s.items.length > 0);

  if (!isApiEnabled || !authenticated) {
    return (
      <EmptyState
        icon="calendar"
        title="Bookings unavailable"
        description={
          authenticated
            ? 'Connect to the Anticlock API to load your bookings.'
            : 'Sign in to view your bookings.'
        }
      />
    );
  }

  if (isLoading) {
    return (
      <View style={styles.wrap}>
        <BookingFilterBar
          active={filter}
          counts={counts}
          onChange={setFilter}
          onOpenFilters={showFilterButton ? () => setSheetOpen(true) : undefined}
        />
        <View style={styles.timeline}>
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading bookings...
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.wrap}>
        <BookingFilterBar
          active={filter}
          counts={counts}
          onChange={setFilter}
          onOpenFilters={showFilterButton ? () => setSheetOpen(true) : undefined}
        />
        <EmptyState
          icon="calendar"
          title="Failed to load bookings"
          description="Please check your connection and try again."
          actionLabel="Retry"
          onAction={() => void refetch()}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <BookingFilterBar
        active={filter}
        counts={counts}
        onChange={setFilter}
        onOpenFilters={showFilterButton ? () => setSheetOpen(true) : undefined}
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

          {hasNextPage ? (
            <PressableScale
              onPress={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
              style={[styles.loadMore, { borderColor: theme.colors.borderSoft }]}>
              <Text style={[styles.loadMoreText, { color: theme.colors.primary }]}>
                {isFetchingNextPage ? 'Loading…' : 'Load more bookings'}
              </Text>
            </PressableScale>
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
  loadingText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  loadMore: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  loadMoreText: { fontSize: 13, fontWeight: '800' },
});
