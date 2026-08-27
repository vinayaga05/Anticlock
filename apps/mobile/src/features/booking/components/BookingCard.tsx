import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Button } from '@/shared/components/Button';
import {
  BOOKING_ACTION_LABELS,
  BookingAction,
  ConsolidatedBooking,
} from '@/shared/data/bookings';

type Props = {
  booking: ConsolidatedBooking;
  onViewDetails?: (booking: ConsolidatedBooking) => void;
};

function statusColor(status: string, theme: ReturnType<typeof useTheme>) {
  if (status === 'confirmed' || status === 'booked') return theme.colors.success;
  if (status === 'provider_assigned' || status === 'upcoming') return theme.colors.primary;
  if (status === 'cancelled') return theme.colors.error;
  if (status === 'completed') return theme.colors.textSecondary;
  return theme.colors.textSecondary;
}

export function BookingCard({ booking, onViewDetails }: Props) {
  const theme = useTheme();

  const handleAction = (action: BookingAction) => {
    if (action === 'view_details') {
      onViewDetails?.(booking);
      return;
    }
    if (action === 'join_now') {
      Alert.alert('Join session', `Opening ${booking.serviceTitle}…`);
      return;
    }
    if (action === 'reschedule') {
      Alert.alert('Reschedule', 'Pick a new slot for this booking.');
      return;
    }
    if (action === 'cancel') {
      Alert.alert('Cancel booking', 'Are you sure you want to cancel?', [
        { text: 'Keep', style: 'cancel' },
        { text: 'Cancel booking', style: 'destructive' },
      ]);
      return;
    }
    if (action === 'book_again') {
      Alert.alert('Book again', 'Opening booking flow…');
    }
  };

  const primaryAction = booking.actions.find(
    a => a === 'join_now' || a === 'book_again',
  );
  const secondaryActions = booking.actions.filter(a => a !== primaryAction);

  const primaryLine = booking.isClass || booking.category === 'home_service'
    ? booking.serviceTitle
    : booking.providerName;
  const secondaryLine = booking.isClass || booking.category === 'home_service'
    ? booking.providerName
    : booking.serviceTitle;

  return (
    <View style={styles.wrap}>
      <View style={styles.body}>
        <Text style={[styles.provider, { color: theme.colors.textPrimary }]}>
          {primaryLine}
        </Text>
        <Text style={[styles.service, { color: theme.colors.textPrimary }]}>
          {secondaryLine}
        </Text>
        <Text style={[styles.when, { color: theme.colors.textSecondary }]}>
          {booking.whenLabel}
        </Text>
        {booking.locationLabel ? (
          <View style={styles.metaRow}>
            {booking.isOnline ? (
              <View style={[styles.badge, { backgroundColor: theme.colors.primarySoft }]}>
                <Text style={[styles.badgeText, { color: theme.colors.primary }]}>
                  {booking.locationLabel}
                </Text>
              </View>
            ) : (
              <Text style={[styles.location, { color: theme.colors.textSecondary }]}>
                {booking.locationLabel}
              </Text>
            )}
          </View>
        ) : null}
        <Text style={[styles.status, { color: statusColor(booking.status, theme) }]}>
          {booking.statusLabel}
        </Text>
      </View>

      {booking.actions.length > 0 ? (
        <View style={styles.actions}>
          {secondaryActions.map(action => (
            <Button
              key={action}
              title={BOOKING_ACTION_LABELS[action]}
              variant="secondary"
              onPress={() => handleAction(action)}
              style={styles.actionBtn}
            />
          ))}
          {primaryAction ? (
            <Button
              title={BOOKING_ACTION_LABELS[primaryAction]}
              variant="primary"
              onPress={() => handleAction(primaryAction)}
              style={styles.actionBtn}
            />
          ) : null}
        </View>
      ) : null}

      <View style={[styles.divider, { backgroundColor: theme.colors.borderSoft }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  body: {
    gap: 4,
  },
  provider: {
    fontSize: 16,
    fontWeight: '700',
  },
  service: {
    fontSize: 15,
    fontWeight: '500',
  },
  when: {
    fontSize: 14,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  location: {
    fontSize: 14,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    flexGrow: 1,
    minWidth: 120,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
});
