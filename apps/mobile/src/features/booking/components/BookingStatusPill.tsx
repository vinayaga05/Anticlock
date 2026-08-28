import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BookingStatus } from '@/shared/data/bookings';

type Props = {
  status: BookingStatus;
  label: string;
};

const STATUS_STYLES: Record<
  BookingStatus,
  { bg: string; text: string; border: string }
> = {
  confirmed: { bg: 'rgba(34,197,94,0.12)', text: '#15803D', border: 'rgba(34,197,94,0.22)' },
  upcoming: { bg: 'rgba(59,130,246,0.12)', text: '#1D4ED8', border: 'rgba(59,130,246,0.22)' },
  online_live: { bg: 'rgba(139,92,246,0.12)', text: '#6D28D9', border: 'rgba(139,92,246,0.22)' },
  provider_assigned: { bg: 'rgba(20,184,166,0.12)', text: '#0F766E', border: 'rgba(20,184,166,0.22)' },
  on_the_way: { bg: 'rgba(249,115,22,0.12)', text: '#C2410C', border: 'rgba(249,115,22,0.22)' },
  completed: { bg: 'rgba(100,116,139,0.12)', text: '#475569', border: 'rgba(100,116,139,0.22)' },
  cancelled: { bg: 'rgba(239,68,68,0.12)', text: '#B91C1C', border: 'rgba(239,68,68,0.22)' },
  pending: { bg: 'rgba(245,158,11,0.12)', text: '#B45309', border: 'rgba(245,158,11,0.22)' },
};

export function BookingStatusPill({ status, label }: Props) {
  const colors = STATUS_STYLES[status] ?? STATUS_STYLES.upcoming;
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: colors.bg, borderColor: colors.border },
      ]}>
      <Text style={[styles.text, { color: colors.text }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
