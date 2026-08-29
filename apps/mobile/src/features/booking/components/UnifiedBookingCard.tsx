import React from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import {
  BOOKING_ACTION_LABELS,
  BookingAction,
  ConsolidatedBooking,
  getBookingWhenDisplay,
  navigateBookingTarget,
  resolveBookingActions,
} from '@/shared/data/bookings';
import { BookingStatusPill } from '@/features/booking/components/BookingStatusPill';

type Props = {
  booking: ConsolidatedBooking;
  onPress?: (booking: ConsolidatedBooking) => void;
  onAction?: (booking: ConsolidatedBooking, action: BookingAction) => void;
  compact?: boolean;
};

function BookingVisual({ booking }: { booking: ConsolidatedBooking }) {
  const isClassThumb = booking.visual === 'thumbnail';
  const size = isClassThumb ? styles.thumbVisual : styles.standardVisual;
  const radius = booking.visual === 'avatar' ? 999 : 14;

  if (booking.imageUrl) {
    return (
      <Image
        source={{ uri: booking.imageUrl }}
        style={[size, { borderRadius: radius }]}
      />
    );
  }

  return (
    <View style={[size, styles.iconVisual, { borderRadius: radius }]}>
      <AppIcon
        name={(booking.iconName as IconName) ?? 'calendar'}
        size={24}
        color="#64748B"
      />
    </View>
  );
}

function ActionButton({
  label,
  primary,
  onPress,
}: {
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} style={{ flex: 1 }}>
      <View
        style={[
          styles.actionBtn,
          primary
            ? { backgroundColor: theme.colors.primary }
            : { backgroundColor: theme.colors.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderSoft },
        ]}>
        <Text
          style={[
            styles.actionText,
            { color: primary ? '#FFFFFF' : theme.colors.textPrimary },
          ]}
          numberOfLines={1}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

export function UnifiedBookingCard({ booking, onPress, onAction, compact }: Props) {
  const theme = useTheme();
  const { primary, secondary } = resolveBookingActions(booking);
  const when = getBookingWhenDisplay(booking);
  const title = booking.isClass ? booking.serviceTitle : booking.providerName || booking.serviceTitle;
  const subtitle = booking.isClass
    ? [booking.providerName, booking.providerRole].filter(Boolean).join(' · ')
    : [booking.providerRole, booking.serviceTitle].filter(Boolean).join(' · ');

  const handleAction = (action: BookingAction) => {
    if (onAction) {
      onAction(booking, action);
      return;
    }
    if (action === 'join_now') {
      Alert.alert('Join session', `Opening ${booking.serviceTitle}…`);
      return;
    }
    if (action === 'directions' || action === 'track' || action === 'contact') {
      Alert.alert(BOOKING_ACTION_LABELS[action], 'This feature will open shortly.');
      return;
    }
    if (action === 'view_details' || action === 'prepare') {
      onPress?.(booking);
      return;
    }
    if (action === 'book_again' || action === 'rate' || action === 'reschedule' || action === 'cancel') {
      Alert.alert(BOOKING_ACTION_LABELS[action], 'Coming soon.');
      return;
    }
    onPress?.(booking);
  };

  const handleCardPress = () => {
    if (onPress) {
      onPress(booking);
      return;
    }
  };

  return (
    <PressableScale onPress={handleCardPress} accessibilityLabel={booking.serviceTitle}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderSoft,
            ...theme.shadows.float,
          },
          compact && styles.cardCompact,
        ]}>
        <View style={styles.topRow}>
          <BookingVisual booking={booking} />
          <View style={styles.main}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.title, { color: theme.colors.textPrimary }]}
                numberOfLines={1}>
                {title}
              </Text>
              <BookingStatusPill status={booking.status} label={booking.statusLabel} />
            </View>
            <Text
              style={[styles.subtitle, { color: theme.colors.textSecondary }]}
              numberOfLines={1}>
              {subtitle}
            </Text>
            <Text style={[styles.when, { color: theme.colors.textPrimary }]}>
              {when}
              {booking.durationMinutes ? ` · ${booking.durationMinutes} min` : ''}
            </Text>
            {booking.locationLabel ? (
              <Text
                style={[styles.location, { color: theme.colors.textSecondary }]}
                numberOfLines={1}>
                {booking.locationLabel}
              </Text>
            ) : null}
            {booking.etaMinutes != null ? (
              <Text style={[styles.eta, { color: theme.colors.primary }]}>
                ETA {booking.etaMinutes} min
              </Text>
            ) : null}
          </View>
        </View>

        {primary || secondary ? (
          <View style={styles.actions}>
            {secondary ? (
              <ActionButton
                label={BOOKING_ACTION_LABELS[secondary]}
                onPress={() => handleAction(secondary)}
              />
            ) : null}
            {primary ? (
              <ActionButton
                label={BOOKING_ACTION_LABELS[primary]}
                primary
                onPress={() => handleAction(primary)}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

export function handleBookingNavigation(
  navigation: { navigate: (screen: string, params?: object) => void },
  booking: ConsolidatedBooking,
  action?: BookingAction,
) {
  if (action === 'view_details' || action === 'prepare' || !action) {
    navigateBookingTarget(navigation, booking);
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  cardCompact: {
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  standardVisual: {
    width: 68,
    height: 68,
    backgroundColor: '#E2E8F0',
  },
  thumbVisual: {
    width: 78,
    height: 72,
    backgroundColor: '#E2E8F0',
  },
  iconVisual: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  main: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  when: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  location: {
    fontSize: 12,
  },
  eta: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
