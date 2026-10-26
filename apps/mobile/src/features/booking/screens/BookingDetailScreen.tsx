import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { EmptyState } from '@/shared/components/EmptyState';
import { Button } from '@/shared/components/Button';
import { BookingStatusPill } from '@/features/booking/components/BookingStatusPill';
import { DateField, TimeField } from '@/features/provider-onboarding/components/DateTimeFields';
import { useTheme } from '@/shared/hooks/useTheme';
import { useAuth } from '@/shared/context/AuthProvider';
import type { RootStackParamList } from '@/shared/navigation/types';
import {
  useBookingQuery,
  useCancelBookingMutation,
  useConfirmCustomerRescheduleMutation,
  useCustomerRescheduleBookingMutation,
} from '@/shared/api/bookingHooks';
import { useProviderBookingActionMutation } from '@/shared/api/providerHooks';
import { mapApiBookingToConsolidated } from '@/shared/utils/bookingMappers';

type RescheduleDraft = { date: string | null; time: string | null };

function futureIso(draft: RescheduleDraft) {
  if (!draft.date || !draft.time) return null;
  const value = new Date(`${draft.date}T${draft.time}:00`);
  return Number.isNaN(value.getTime()) || value.getTime() <= Date.now()
    ? null
    : value.toISOString();
}

export function BookingDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'BookingDetail'>>();
  const { user } = useAuth();
  const query = useBookingQuery(route.params.bookingId);
  const cancelBooking = useCancelBookingMutation(route.params.bookingId);
  const customerReschedule = useCustomerRescheduleBookingMutation(route.params.bookingId);
  const confirmCustomerReschedule = useConfirmCustomerRescheduleMutation(route.params.bookingId);
  const providerAction = useProviderBookingActionMutation(query.data?.providerId ?? '');
  const [reschedule, setReschedule] = useState<RescheduleDraft | null>(null);
  const booking = query.data;
  const mapped = useMemo(
    () => (booking ? mapApiBookingToConsolidated(booking) : null),
    [booking],
  );

  useFocusEffect(useCallback(() => {
    void query.refetch();
    // Query object is intentionally excluded; booking id is stable for this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params.bookingId]));

  const runProviderAction = async (
    action: 'accept' | 'reject' | 'complete' | 'no_show',
  ) => {
    try {
      await providerAction.mutateAsync({ bookingId: route.params.bookingId, action });
    } catch (error) {
      Alert.alert('Could not update booking', (error as Error).message);
    }
  };

  const submitReschedule = async () => {
    if (!booking || !reschedule) return;
    const startsAt = futureIso(reschedule);
    if (!startsAt) {
      Alert.alert('Choose a future time', 'Select a valid date and time.');
      return;
    }
    try {
      if (booking.viewerRole === 'provider') {
        await providerAction.mutateAsync({
          bookingId: booking.id,
          action: 'reschedule',
          startsAt,
        });
      } else {
        await customerReschedule.mutateAsync({ startsAt });
      }
      setReschedule(null);
    } catch (error) {
      Alert.alert('Could not reschedule', (error as Error).message);
    }
  };

  const cancel = () => {
    Alert.alert('Cancel booking?', 'The provider will be notified immediately.', [
      { text: 'Keep booking', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: () => cancelBooking.mutate(
          { reason: 'Cancelled by customer' },
          { onError: error => Alert.alert('Could not cancel', (error as Error).message) },
        ),
      },
    ]);
  };

  const joinWindow = booking
    ? {
        opens: new Date(booking.startsAt).getTime() - 15 * 60_000,
        closes: new Date(
          booking.endsAt ??
          new Date(
            new Date(booking.startsAt).getTime() + (booking.durationMinutes ?? 60) * 60_000,
          ).toISOString(),
        ).getTime() + 30 * 60_000,
      }
    : null;
  const canJoin = Boolean(
    booking?.status === 'confirmed' &&
    booking.serviceMode === 'online' &&
    joinWindow &&
    Date.now() >= joinWindow.opens &&
    Date.now() <= joinWindow.closes,
  );
  const join = () => {
    if (!booking?.providerId || !user) return;
    const providerViewer = booking.viewerRole === 'provider';
    navigation.navigate('Call', {
      mode: 'video',
      name: providerViewer
        ? booking.customerName ?? 'Customer'
        : booking.detail.providerName ?? 'Provider',
      targetProfile: providerViewer
        ? { id: booking.mobileUserId, type: 'personal' }
        : { id: booking.providerId, type: 'business' },
      viewerProfile: providerViewer
        ? { id: booking.providerId, type: 'business' }
        : { id: user.id, type: 'personal' },
      bookingId: booking.id,
    });
  };

  const openDirections = () => {
    if (!booking) return;
    const latitude = booking.detail.mapLatitude;
    const longitude = booking.detail.mapLongitude;
    const queryValue = latitude != null && longitude != null
      ? `${latitude},${longitude}`
      : booking.detail.address ?? booking.detail.locationLabel;
    if (queryValue) {
      void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryValue)}`);
    }
  };

  if (query.isLoading) {
    return (
      <ScreenContainer tabAware={false}>
        <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>
      </ScreenContainer>
    );
  }
  if (query.error || !booking || !mapped) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState
          icon="calendar"
          title="Booking unavailable"
          description="It may have been removed, or you may not have permission to view it."
          actionLabel="Retry"
          onAction={() => void query.refetch()}
        />
      </ScreenContainer>
    );
  }

  const active = ['pending', 'confirmed', 'reschedule_requested'].includes(booking.status);
  const displayName = booking.viewerRole === 'provider'
    ? booking.customerName ?? 'Customer'
    : booking.detail.providerName ?? 'Provider';

  return (
    <ScreenContainer scrollable tabAware={false} contentStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft }]}>
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{booking.detail.serviceTitle}</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{displayName}</Text>
          </View>
          <BookingStatusPill status={mapped.status} label={mapped.statusLabel} />
        </View>
        <Detail label="Date and time" value={new Date(booking.startsAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} />
        <Detail label="Mode" value={booking.bookingMode === 'online' ? 'Online' : 'On-site'} />
        <Detail label="Booking type" value={booking.bookingType.replaceAll('_', ' ')} />
        {booking.detail.locationLabel || booking.detail.address ? (
          <Detail label="Location" value={booking.detail.address ?? booking.detail.locationLabel!} />
        ) : null}
        {booking.amount != null ? <Detail label="Price" value={`₹${booking.amount}`} /> : null}
        <Detail label="Payment" value={booking.paymentStatus} />
        {booking.detail.notes ? <Detail label="Notes" value={booking.detail.notes} /> : null}
      </View>

      {reschedule ? (
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Request a new time</Text>
          <DateField value={reschedule.date} label="New booking date" onChange={date => setReschedule(value => value ? { ...value, date } : value)} />
          <TimeField value={reschedule.time} label="New booking time" onChange={time => setReschedule(value => value ? { ...value, time } : value)} />
          <Button title="Send new time" onPress={() => void submitReschedule()} loading={providerAction.isPending || customerReschedule.isPending} />
          <Button title="Close" variant="secondary" onPress={() => setReschedule(null)} />
        </View>
      ) : null}

      <View style={styles.actions}>
        {canJoin ? <Button title="Join video session" onPress={join} /> : null}
        {booking.bookingMode === 'on_site' && (booking.detail.address || booking.detail.locationLabel) ? (
          <Button title="Directions" variant="secondary" onPress={openDirections} />
        ) : null}
        {booking.viewerRole === 'provider' && ['pending', 'reschedule_requested'].includes(booking.status) ? (
          <>
            <Button title="Accept booking" onPress={() => void runProviderAction('accept')} loading={providerAction.isPending} />
            <Button title="Reject booking" variant="secondary" onPress={() => void runProviderAction('reject')} disabled={providerAction.isPending} />
          </>
        ) : null}
        {booking.viewerRole === 'provider' && booking.status === 'confirmed' ? (
          <>
            <Button title="Mark completed" onPress={() => void runProviderAction('complete')} loading={providerAction.isPending} />
            <Button title="Mark no-show" variant="secondary" onPress={() => void runProviderAction('no_show')} disabled={providerAction.isPending} />
          </>
        ) : null}
        {booking.viewerRole === 'customer' &&
        booking.status === 'reschedule_requested' &&
        booking.metadata?.rescheduleRequestedBy === 'provider' ? (
          <Button
            title="Accept new time"
            onPress={() => confirmCustomerReschedule.mutate(undefined, {
              onError: error => Alert.alert('Could not accept time', (error as Error).message),
            })}
            loading={confirmCustomerReschedule.isPending}
          />
        ) : null}
        {active ? (
          <Button
            title="Reschedule"
            variant="secondary"
            onPress={() => setReschedule({
              date: booking.startsAt.slice(0, 10),
              time: booking.startsAt.slice(11, 16),
            })}
          />
        ) : null}
        {booking.viewerRole === 'customer' && active ? (
          <Button title="Cancel booking" variant="secondary" onPress={cancel} loading={cancelBooking.isPending} />
        ) : null}
      </View>
    </ScreenContainer>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  center: { minHeight: 240, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 3 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  detailRow: { gap: 3 },
  detailLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  actions: { gap: 10 },
});
