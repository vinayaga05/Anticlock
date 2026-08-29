import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import {
  BOOKING_ACTION_LABELS,
  BookingAction,
  ConsolidatedBooking,
  getBookingWhenDisplay,
  resolveBookingActions,
} from '@/shared/data/bookings';
import { formatRelativeStart } from '@/shared/utils/bookingDates';
import { BookingStatusPill } from '@/features/booking/components/BookingStatusPill';

type Props = {
  booking: ConsolidatedBooking;
  onPress?: (booking: ConsolidatedBooking) => void;
  onAction?: (booking: ConsolidatedBooking, action: BookingAction) => void;
};

export function NextUpBookingCard({ booking, onPress: _onPress, onAction }: Props) {
  const theme = useTheme();
  const when = getBookingWhenDisplay(booking);
  const relative = formatRelativeStart(booking.startsAt);
  const { primary, secondary } = resolveBookingActions(booking);
  const actionLabel = (action: BookingAction) => {
    if (action === 'contact') return 'Message';
    if (action === 'track') return 'Track Provider';
    return BOOKING_ACTION_LABELS[action];
  };

  const runAction = (action: BookingAction) => {
    onAction?.(booking, action);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
        NEXT UP
      </Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderSoft,
            ...theme.shadows.float,
          },
        ]}>
        <View style={styles.metaRow}>
          <Text style={[styles.whenTop, { color: theme.colors.textPrimary }]}>{when}</Text>
          <BookingStatusPill
            status={booking.isOnline ? 'online_live' : booking.status}
            label={booking.isOnline ? 'ONLINE' : booking.statusLabel}
          />
        </View>

        <View style={styles.body}>
          {booking.imageUrl ? (
            <Image source={{ uri: booking.imageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <AppIcon
                name={(booking.iconName as IconName) ?? 'doctor'}
                size={28}
                color={theme.colors.primary}
              />
            </View>
          )}
          <View style={styles.info}>
            <Text style={[styles.name, { color: theme.colors.textPrimary }]}>
              {booking.providerName}
            </Text>
            {booking.providerRole ? (
              <Text style={[styles.role, { color: theme.colors.textSecondary }]}>
                {booking.providerRole}
              </Text>
            ) : null}
            <Text style={[styles.service, { color: theme.colors.textSecondary }]}>
              {booking.serviceTitle}
            </Text>
          </View>
        </View>

        <Text style={[styles.relative, { color: theme.colors.primary }]}>{relative}</Text>

        <View style={styles.actions}>
          {secondary ? (
            <PressableScale
              onPress={() => runAction(secondary)}
              style={[styles.secondaryBtn, { borderColor: theme.colors.primary }]}>
              <Text style={[styles.secondaryText, { color: theme.colors.primary }]}>
                {actionLabel(secondary)}
              </Text>
            </PressableScale>
          ) : null}
          {primary ? (
            <PressableScale
              onPress={() => runAction(primary)}
              style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.primaryText}>{actionLabel(primary)}</Text>
            </PressableScale>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  whenTop: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  body: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '800' },
  role: { fontSize: 13, fontWeight: '500' },
  service: { fontSize: 12 },
  relative: { fontSize: 13, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  secondaryText: { fontSize: 13, fontWeight: '700' },
  primaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
