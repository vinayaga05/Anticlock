import React from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import {
  BOOKING_ACTION_LABELS,
  BookingAction,
  ConsolidatedBooking,
} from '@/shared/data/bookings';

type Props = {
  booking: ConsolidatedBooking;
  onPress?: (booking: ConsolidatedBooking) => void;
  onAction?: (booking: ConsolidatedBooking, action: BookingAction) => void;
};

function ActionPill({
  label,
  filled,
  onPress,
}: {
  label: string;
  filled?: boolean;
  onPress?: () => void;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label}>
      <View
        style={[
          styles.actionPill,
          filled ? styles.actionPillFilled : styles.actionPillOutline,
        ]}>
        <Text
          style={[
            styles.actionPillText,
            { color: filled ? '#FFFFFF' : '#0F766E' },
          ]}
          numberOfLines={1}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

function DoctorCard({ booking, onPress, onAction }: Props) {
  const lines = booking.detailLines ?? [];

  return (
    <PressableScale onPress={() => onPress?.(booking)} accessibilityLabel={booking.providerName}>
      <View style={styles.doctorCard}>
        <View style={styles.doctorLeft}>
          <Image
            source={{ uri: booking.imageUrl }}
            style={styles.doctorAvatar}
          />
          {booking.experienceYears ? (
            <View style={styles.expBadge}>
              <Text style={styles.expBadgeText}>{booking.experienceYears} YEARS</Text>
            </View>
          ) : null}
          <View style={styles.starRow}>
            <AppIcon name="star" size={12} color="#FBBF24" fill="#FBBF24" />
            <AppIcon name="star" size={12} color="#FBBF24" fill="#FBBF24" />
          </View>
        </View>

        <View style={styles.doctorCenter}>
          <Text style={styles.doctorName}>{booking.providerName}</Text>
          {booking.subtitle ? (
            <Text style={styles.doctorSub}>{booking.subtitle}</Text>
          ) : null}
          {lines.map(line => (
            <Text key={line} style={styles.doctorLine} numberOfLines={2}>
              {line}
            </Text>
          ))}
        </View>

        <View style={styles.doctorRight}>
          {booking.isLive ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>ON</Text>
            </View>
          ) : null}
          <View style={styles.doctorActions}>
            <ActionPill label="consultation" />
            <ActionPill label={booking.whenLabel.replace(' · ', '\n')} />
            <ActionPill
              label={BOOKING_ACTION_LABELS.join_now}
              filled
              onPress={() => onAction?.(booking, 'join_now')}
            />
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

function ClassCard({ booking, onPress, onAction }: Props) {
  return (
    <PressableScale onPress={() => onPress?.(booking)} accessibilityLabel={booking.serviceTitle}>
      <View style={styles.classCard}>
        <ImageBackground
          source={{ uri: booking.imageUrl }}
          style={styles.classImage}
          imageStyle={styles.classImageRadius}>
          <View style={styles.classGradient}>
            <View style={styles.classMeta}>
              <Text style={styles.classTitle}>{booking.serviceTitle}</Text>
              <Text style={styles.classSub}>
                Coach: {booking.providerName}
              </Text>
              <Text style={styles.classSub}>{booking.scheduleLabel ?? booking.whenLabel}</Text>
            </View>
            <PressableScale
              onPress={() => onAction?.(booking, 'join_now')}
              accessibilityLabel="Book now">
              <View style={styles.classCta}>
                <Text style={styles.classCtaText}>Book Now</Text>
              </View>
            </PressableScale>
          </View>
        </ImageBackground>
      </View>
    </PressableScale>
  );
}

function LabCard({ booking, onPress, onAction }: Props) {
  const lines = booking.detailLines ?? [];
  const statusAction = booking.actions.includes('cancel')
    ? 'Booked'
    : BOOKING_ACTION_LABELS[booking.actions[0] ?? 'view_details'];

  return (
    <PressableScale onPress={() => onPress?.(booking)} accessibilityLabel={booking.providerName}>
      <View style={styles.labCard}>
        <View style={styles.labLeft}>
          <Image source={{ uri: booking.imageUrl }} style={styles.labLogo} />
          {booking.experienceYears ? (
            <View style={styles.expBadge}>
              <Text style={styles.expBadgeText}>{booking.experienceYears} YEARS</Text>
            </View>
          ) : null}
          <View style={styles.starRow}>
            <AppIcon name="star" size={12} color="#FBBF24" fill="#FBBF24" />
            <AppIcon name="star" size={12} color="#FBBF24" fill="#FBBF24" />
          </View>
        </View>

        <View style={styles.labCenter}>
          <Text style={styles.labName}>{booking.providerName}</Text>
          {lines.map(line => (
            <Text key={line} style={styles.labLine}>
              {line}
            </Text>
          ))}
        </View>

        <View style={styles.labActions}>
          <ActionPill label="Blood Collect" />
          <ActionPill label={booking.whenLabel.replace(' · ', '\n')} />
          <ActionPill
            label={statusAction}
            filled={statusAction === 'Booked'}
            onPress={() =>
              onAction?.(booking, booking.actions[0] ?? 'view_details')
            }
          />
        </View>
      </View>
    </PressableScale>
  );
}

function DefaultCard({ booking, onPress, onAction }: Props) {
  const theme = useTheme();
  const primary = booking.actions.find(a => a === 'join_now' || a === 'book_again');

  return (
    <PressableScale onPress={() => onPress?.(booking)}>
      <View style={[styles.defaultCard, { backgroundColor: theme.colors.surface }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.doctorName, { color: theme.colors.textPrimary }]}>
            {booking.serviceTitle}
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>
            {booking.providerName}
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
            {booking.whenLabel}
          </Text>
          <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 13 }}>
            {booking.statusLabel}
          </Text>
        </View>
        {primary ? (
          <ActionPill
            label={BOOKING_ACTION_LABELS[primary]}
            filled
            onPress={() => onAction?.(booking, primary)}
          />
        ) : null}
      </View>
    </PressableScale>
  );
}

export function BookingCard({ booking, onPress, onAction }: Props) {
  const handleAction = (b: ConsolidatedBooking, action: BookingAction) => {
    if (onAction) {
      onAction(b, action);
      return;
    }
    if (action === 'join_now') {
      Alert.alert('Join session', `Opening ${b.serviceTitle}…`);
      return;
    }
    onPress?.(b);
  };

  if (booking.category === 'appointment' && booking.isOnline) {
    return (
      <DoctorCard booking={booking} onPress={onPress} onAction={handleAction} />
    );
  }
  if (booking.category === 'class' || booking.isClass) {
    return (
      <ClassCard booking={booking} onPress={onPress} onAction={handleAction} />
    );
  }
  if (booking.category === 'lab') {
    return <LabCard booking={booking} onPress={onPress} onAction={handleAction} />;
  }
  return (
    <DefaultCard booking={booking} onPress={onPress} onAction={handleAction} />
  );
}

const styles = StyleSheet.create({
  doctorCard: {
    flexDirection: 'row',
    backgroundColor: '#E0F2FE',
    borderRadius: 20,
    padding: 12,
    gap: 10,
    alignItems: 'flex-start',
  },
  doctorLeft: {
    width: 72,
    alignItems: 'center',
    gap: 6,
  },
  doctorAvatar: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#CBD5E1',
  },
  expBadge: {
    backgroundColor: '#14B8A6',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
  },
  expBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
  },
  doctorCenter: {
    flex: 1,
    gap: 2,
    paddingTop: 2,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  doctorSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  doctorLine: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  doctorRight: {
    alignItems: 'flex-end',
    gap: 8,
    minWidth: 96,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  doctorActions: {
    gap: 6,
    alignItems: 'stretch',
    width: 96,
  },
  actionPill: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: 'center',
  },
  actionPillOutline: {
    backgroundColor: '#99F6E4',
  },
  actionPillFilled: {
    backgroundColor: '#0D9488',
  },
  actionPillText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  classCard: {
    borderRadius: 22,
    overflow: 'hidden',
    height: 168,
  },
  classImage: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  classImageRadius: {
    borderRadius: 22,
  },
  classGradient: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.42)',
    gap: 10,
  },
  classMeta: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    padding: 10,
    gap: 2,
  },
  classTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  classSub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    fontWeight: '500',
  },
  classCta: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  classCtaText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '800',
  },
  labCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  labLeft: {
    width: 72,
    alignItems: 'center',
    gap: 6,
  },
  labLogo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#FCE7F3',
  },
  labCenter: {
    flex: 1,
    gap: 2,
    paddingTop: 2,
  },
  labName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  labLine: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  labActions: {
    gap: 6,
    width: 96,
    justifyContent: 'center',
  },
  defaultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    gap: 12,
  },
});
